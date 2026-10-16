import test from 'node:test';
import assert from 'node:assert/strict';
import { tempCoachingData, identityAuthority, fixedClock, testMutationId, testUsers } from './coaching-helpers.mjs';
import { openCoachingDb } from '../coaching/db.js';
import { occurrenceService } from '../coaching/occurrences.js';
import { planService, validateWorkoutContent } from '../coaching/plans.js';
import { workspaceService } from '../coaching/workspaces.js';
import { sessionService } from '../coaching/sessions.js';
import { relationshipHandlers } from '../coaching/routes.js';

const prescription = { dayName: 'Mobility once', unit: 'kg', exercises: [{ id: 'plank', name: 'Plank', mode: 'time', sets: [{ seconds: 30 }], restSec: 20 }] };
function setup(t) {
  const identities = identityAuthority(), now = fixedClock();
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities });
  t.after(() => store.close());
  store.insertRelationship({ id: 'daily-rel', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'Asia/Kolkata', consentText: 'test', now: now().toISOString() });
  const occurrences = occurrenceService(store, { now });
  const config = { trainerIds: new Set([testUsers.trainerA.id]) };
  const plans = planService(store, { now, validateContent: (_, value) => validateWorkoutContent(value), afterPublish: occurrences.reconcile, afterRemove: occurrences.removeAssignment });
  return { store, occurrences, plans, sessions: sessionService(store, { now }), workspace: workspaceService(store, { now, identities, config, occurrences }), handlers: relationshipHandlers({ store, occurrences, config }) };
}

test('one-time assignment without a plan is visible, startable and does not recur', t => {
  const f = setup(t);
  const row = f.occurrences.create(testUsers.trainerA, { relationshipId: 'daily-rel', scheduledDate: '2026-09-07', prescription });
  const view = f.workspace.get(testUsers.clientA, 'daily-rel');
  assert.equal(view.workout, null);
  assert.equal(view.occurrences.length, 1);
  assert.equal(view.occurrences[0].oneTime, true);
  assert.equal(view.today.workoutName, 'Mobility once');
  f.occurrences.catchUpAll();
  assert.equal(f.occurrences.list(testUsers.clientA, 'daily-rel').length, 1);
  const session = f.sessions.start(testUsers.clientA, { sessionId: testMutationId('start-once'), occurrenceId: row.id, expectedOccurrenceVersion: row.version });
  assert.equal(session.prescriptionSnapshot.exercises[0].sets[0].seconds, 30);
  assert.throws(() => f.occurrences.customize(testUsers.trainerA, row.id, row.version, prescription), e => e.code === 'OCCURRENCE_LOCKED');
});

test('one-time date survives recurring publication and removal, with no duplicate on its date', t => {
  const f = setup(t);
  const once = f.occurrences.create(testUsers.trainerA, { relationshipId: 'daily-rel', scheduledDate: '2026-09-07', prescription });
  const view = f.workspace.get(testUsers.trainerA, 'daily-rel');
  const plan = { name: 'Weekly', unit: 'kg', days: [{ id: 'weekly', name: 'Weekly mobility', weekdays: [1], exercises: prescription.exercises }] };
  const published = f.plans.publish(testUsers.trainerA.id, { relationshipId: 'daily-rel', kind: 'workout', expectedVersion: view.workoutAssignmentVersion, content: plan });
  const rows = f.occurrences.list(testUsers.trainerA, 'daily-rel');
  assert.equal(rows.filter(r => r.scheduledDate === '2026-09-07' && r.state !== 'canceled').length, 1);
  assert.equal(rows.find(r => r.id === once.id).prescription.dayName, 'Mobility once');
  assert.ok(rows.find(r => r.scheduledDate === '2026-09-14'));
  f.plans.remove(testUsers.trainerA.id, { relationshipId: 'daily-rel', expectedVersion: published.version });
  assert.equal(f.occurrences.list(testUsers.trainerA, 'daily-rel').find(r => r.id === once.id).state, 'scheduled');
});

test('one-time creation rejects conflicting dates, past dates, invalid content and unrelated users', t => {
  const f = setup(t), input = { relationshipId: 'daily-rel', scheduledDate: '2026-09-07', prescription };
  assert.throws(() => f.occurrences.create(testUsers.clientA, input), e => e.status === 404);
  assert.throws(() => f.occurrences.create(testUsers.trainerB, input), e => e.status === 404);
  assert.throws(() => f.occurrences.create(testUsers.trainerA, { ...input, scheduledDate: '2026-09-06' }), e => e.status === 422);
  assert.throws(() => f.occurrences.create(testUsers.trainerA, { ...input, prescription: { ...prescription, exercises: [] } }), e => e.status === 422);
  f.occurrences.create(testUsers.trainerA, input);
  assert.throws(() => f.occurrences.create(testUsers.trainerA, input), e => e.code === 'DATE_OCCUPIED');
});

test('create route is idempotent and refuses stale or revoked replays', t => {
  const f = setup(t), body = { mutationId: testMutationId('create-once'), relationshipId: 'daily-rel', scheduledDate: '2026-09-07', prescription };
  const create = () => f.handlers['POST /api/coaching/occurrences/create']({ user: testUsers.trainerA, body });
  const first = create();
  assert.equal(create().id, first.id);
  assert.equal(f.occurrences.list(testUsers.clientA, 'daily-rel').length, 1);
  f.occurrences.move(testUsers.trainerA, first.id, first.version, '2026-09-08');
  assert.throws(create, e => e.status === 409);
  f.store.db.prepare("UPDATE client_relationships SET status='ended', ended_at='2026-09-07T09:00:00Z' WHERE id='daily-rel'").run();
  assert.throws(create, e => e.status === 404);
});
