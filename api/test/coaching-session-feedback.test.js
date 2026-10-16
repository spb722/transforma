import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { sessionFeedbackService } from '../coaching/session-feedback.js';
import { sessionService } from '../coaching/sessions.js';
import { progressService } from '../coaching/progress.js';
import { openCoachingDb } from '../coaching/db.js';
import { tempCoachingData, identityAuthority, testUsers } from './coaching-helpers.mjs';

function fixture(t, state = 'finished') {
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities: identityAuthority() });
  t.after(() => store.close());
  store.insertRelationship({ id: 'r', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'yes', now: '2026-09-01T00:00:00Z' });
  store.db.prepare("INSERT INTO plan_assignments(id,relationship_id,kind,version,created_at,updated_at) VALUES('a','r','workout',1,'x','x')").run();
  store.db.prepare("INSERT INTO plan_revisions(id,assignment_id,revision_number,content_json,published_by,published_at) VALUES('v','a',1,'{}','trainer-a','x')").run();
  store.db.prepare("INSERT INTO workout_occurrences(id,assignment_id,relationship_id,revision_id,recurrence_key,scheduled_date,original_date,state,prescription_json,created_at,updated_at) VALUES('o','a','r','v','k','2026-09-07','2026-09-07','completed','{}','x','x')").run();
  const id = randomUUID();
  store.db.prepare("INSERT INTO assigned_sessions(id,occurrence_id,relationship_id,client_id,revision_id,state,started_at,scheduled_date,time_zone,unit,prescription_json) VALUES(?,'o','r','client-a','v',?,'2026-09-07T08:00:00Z','2026-09-07','UTC','kg','{}')").run(id, state);
  return { store, id, service: sessionFeedbackService(store), request: { expectedVersion: 0, mutationId: randomUUID(), note: 'Knee uncomfortable in squats', difficulty: 4, pain: 3 } };
}

test('client feedback, trainer review and client edits stay tied to the exact session', t => {
  const { store, service, id, request } = fixture(t);
  const saved = service.save(testUsers.clientA, id, request);
  assert.equal(saved.needsAttention, true);
  assert.equal(saved.pain, 3);
  assert.deepEqual(service.save(testUsers.clientA, id, request), saved);
  assert.deepEqual(progressService(store).get(testUsers.trainerA, 'r').sessions[0].feedback, saved);
  const reviewed = service.review(testUsers.trainerA, id, { expectedVersion: 1, mutationId: randomUUID(), response: 'I will adjust the next session.' });
  assert.equal(reviewed.needsAttention, false);
  assert.equal(reviewed.version, 2);
  assert.equal(service.get(testUsers.clientA, id).response, reviewed.response);
  const edited = service.save(testUsers.clientA, id, { ...request, mutationId: randomUUID(), expectedVersion: 2, note: 'Adding more detail' });
  assert.equal(edited.needsAttention, true);
  assert.equal(edited.response, reviewed.response);
  const cleared = service.save(testUsers.clientA, id, { expectedVersion: 3, mutationId: randomUUID(), note: '', difficulty: null, pain: null });
  assert.equal(cleared.needsAttention, false);
});

test('feedback validates scales, note types, lengths, and required version', t => {
  const { service, id, request } = fixture(t);
  for (const patch of [{ difficulty: 0 }, { difficulty: 6 }, { difficulty: '3' }, { difficulty: 2.5 }, { pain: -1 }, { pain: 11 }, { note: {} }, { note: 'a'.repeat(1001) }, { expectedVersion: undefined }, { expectedVersion: '0' }]) {
    assert.throws(() => service.save(testUsers.clientA, id, { ...request, ...patch }), error => error.status === 422);
  }
  assert.equal(service.save(testUsers.clientA, id, { ...request, difficulty: 1, pain: 0 }).pain, 0);
});

test('stale edits and mutation-id reuse cannot overwrite feedback', t => {
  const { service, id, request } = fixture(t);
  service.save(testUsers.clientA, id, request);
  assert.throws(() => service.save(testUsers.clientA, id, { ...request, note: 'Changed request' }), error => error.code === 'IDEMPOTENCY_CONFLICT');
  assert.throws(() => service.save(testUsers.clientA, id, { ...request, mutationId: randomUUID() }), error => error.code === 'VERSION_CONFLICT');
});

test('other clients and trainers cannot read, write or review session feedback', t => {
  const { service, id, request } = fixture(t);
  for (const user of [testUsers.clientB, testUsers.trainerB]) {
    assert.throws(() => service.get(user, id), error => error.status === 404);
    assert.throws(() => service.save(user, id, request), error => error.status === 404);
    assert.throws(() => service.review(user, id, request), error => error.status === 404);
  }
  assert.throws(() => service.save(testUsers.trainerA, id, request), error => error.status === 404);
  assert.throws(() => service.review(testUsers.clientA, id, request), error => error.status === 404);
});

test('ending coaching immediately revokes trainer read, review and review replay', t => {
  const { store, service, id, request } = fixture(t);
  service.save(testUsers.clientA, id, request);
  const review = { expectedVersion: 1, mutationId: randomUUID(), response: '' };
  service.review(testUsers.trainerA, id, review);
  store.db.prepare("UPDATE client_relationships SET status='ended' WHERE id='r'").run();
  assert.throws(() => service.get(testUsers.trainerA, id), error => error.status === 404);
  assert.throws(() => service.review(testUsers.trainerA, id, review), error => error.status === 404);
  assert.equal(service.get(testUsers.clientA, id).version, 2);
  assert.equal(service.save(testUsers.clientA, id, { ...request, expectedVersion: 2, mutationId: randomUUID() }).version, 3);
});

test('feedback never changes immutable result hash; delayed offline result can finish then send feedback', t => {
  const { store, service, id, request } = fixture(t, 'started');
  assert.throws(() => service.save(testUsers.clientA, id, request), error => error.code === 'RESULT_PENDING');
  const sessions = sessionService(store);
  const result = { sessionId: id, state: 'finished', actualWorkout: { entries: [] } };
  sessions.finish(testUsers.clientA, result);
  const hash = store.db.prepare('SELECT result_hash FROM assigned_sessions WHERE id=?').get(id).result_hash;
  service.save(testUsers.clientA, id, request);
  assert.equal(sessions.finish(testUsers.clientA, result).feedback.note, request.note);
  assert.equal(store.db.prepare('SELECT result_hash FROM assigned_sessions WHERE id=?').get(id).result_hash, hash);
  assert.throws(() => sessions.finish(testUsers.clientA, { ...result, actualWorkout: { entries: [{ id: 'other', sets: [] }] } }), error => error.code === 'SESSION_CONFLICT');
});
