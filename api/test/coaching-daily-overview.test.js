import test from 'node:test';
import assert from 'node:assert/strict';
import { tempCoachingData, identityAuthority, fixedClock, testUsers } from './coaching-helpers.mjs';
import { openCoachingDb } from '../coaching/db.js';
import { workspaceService } from '../coaching/workspaces.js';
import { occurrenceDaySummary } from '../coaching/day-summary.js';

const prescription = JSON.stringify({ dayName: 'Full Body', exercises: [{ name: 'Squat', sets: [{ reps: 8 }] }] });
const occurrence = (state = 'scheduled', date = '2026-09-07') => ({ id: 'o', scheduled_date: date, state, prescription_json: prescription });
const session = (state, classification) => ({ id: 's', state, started_at: '2026-09-07T08:00:00Z', client_finished_at: state === 'started' ? null : '2026-09-07T09:00:00Z', received_at: state === 'started' ? null : '2026-09-07T09:01:00Z', prescription_json: prescription, summary_json: classification ? JSON.stringify({ classification }) : null });

test('daily state separates missed, day off, partial, empty, and outstanding uploads', () => {
  const day = (row, attempts = []) => occurrenceDaySummary(row, attempts, '2026-09-08', 'Asia/Kolkata');
  assert.equal(day(occurrence()).state, 'missed');
  assert.equal(day(occurrence('scheduled', '2026-09-08')).state, 'scheduled');
  assert.equal(day({ ...occurrence('canceled'), cancellation_reason: 'explicit' }).state, 'day_off');
  assert.equal(day({ ...occurrence('canceled'), cancellation_reason: 'plan_removed' }).state, 'no_workout');
  const awaiting = day(occurrence('started'), [session('started')]);
  assert.equal(awaiting.state, 'in_progress');
  assert.equal(awaiting.syncStatus, 'awaiting_result');
  assert.equal(awaiting.finishedAt, null);
  assert.equal(day(occurrence('completed'), [session('finished', 'partial')]).state, 'partial');
  assert.equal(day(occurrence('completed'), [session('finished', 'zero')]).label, 'Finished with no sets');
  assert.equal(day(occurrence('started'), [session('abandoned', 'abandoned')]).state, 'abandoned');
  const completed = day(occurrence('completed'), [session('finished', 'completed')]);
  assert.equal(completed.state, 'completed');
  assert.equal(completed.syncStatus, 'received');
  assert.equal(completed.finishedAt, '2026-09-07T09:00:00Z');
});

test('daily overview uses each relationship midnight and exposes the same workspace day', () => {
  const identities = identityAuthority();
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities });
  const now = fixedClock('2026-09-08T00:30:00.000Z');
  const config = { trainerIds: new Set([testUsers.trainerA.id]) };
  try {
    for (const [id, clientId, timeZone] of [['east', testUsers.clientA.id, 'Asia/Kolkata'], ['west', testUsers.clientB.id, 'America/Los_Angeles']]) {
      store.insertRelationship({ id, trainerId: testUsers.trainerA.id, clientId, timeZone, consentText: 'yes', now: now().toISOString() });
      store.db.prepare("INSERT INTO plan_assignments(id,relationship_id,kind,version,created_at,updated_at) VALUES(?,?,'workout',1,'x','x')").run(`a-${id}`, id);
      store.db.prepare("INSERT INTO plan_revisions(id,assignment_id,revision_number,content_json,published_by,published_at) VALUES(?,?,1,?,'trainer-a','x')").run(`v-${id}`, `a-${id}`, JSON.stringify({ name: 'Weekly', days: [{ weekdays: [1] }] }));
      store.db.prepare('UPDATE plan_assignments SET current_revision_id=? WHERE id=?').run(`v-${id}`, `a-${id}`);
      store.db.prepare("INSERT INTO workout_occurrences(id,assignment_id,relationship_id,revision_id,recurrence_key,scheduled_date,original_date,state,prescription_json,created_at,updated_at) VALUES(?,?,?,?,'monday','2026-09-07','2026-09-07','scheduled',?,'x','x')").run(`o-${id}`, `a-${id}`, id, `v-${id}`, prescription);
    }
    const workspaces = workspaceService(store, { config, identities, now });
    const items = workspaces.overview(testUsers.trainerA).items;
    const east = items.find(item => item.relationship.id === 'east');
    const west = items.find(item => item.relationship.id === 'west');
    assert.equal(east.today.date, '2026-09-08');
    assert.equal(east.today.reason, 'planned_rest_day');
    assert.equal(east.missedWorkouts[0].date, '2026-09-07');
    assert.equal(west.today.date, '2026-09-07');
    assert.equal(west.today.workoutName, 'Full Body');
    assert.equal(west.today.state, 'scheduled');
    assert.equal(west.missedWorkouts.length, 0);
    const workspace = workspaces.get(testUsers.trainerA, 'west');
    assert.deepEqual(workspace.today, west.today);
    assert.equal(workspace.occurrences[0].displayState, 'scheduled');
    assert.deepEqual(workspace.occurrences, workspace.workout.occurrences);
  } finally { store.close(); }
});

test('no assigned plan differs from a rest day and top-level occurrence history survives plan removal', () => {
  const identities = identityAuthority();
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities });
  const now = fixedClock();
  try {
    store.insertRelationship({ id: 'r', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'yes', now: now().toISOString() });
    const service = workspaceService(store, { config: { trainerIds: new Set([testUsers.trainerA.id]) }, identities, now });
    assert.equal(service.get(testUsers.trainerA, 'r').today.reason, 'no_plan');
    store.db.prepare("INSERT INTO plan_assignments(id,relationship_id,kind,version,created_at,updated_at) VALUES('a','r','workout',1,'x','x')").run();
    store.db.prepare("INSERT INTO plan_revisions(id,assignment_id,revision_number,content_json,published_by,published_at) VALUES('v','a',1,'{}','trainer-a','x')").run();
    store.db.prepare("INSERT INTO workout_occurrences(id,assignment_id,relationship_id,revision_id,recurrence_key,scheduled_date,original_date,state,prescription_json,created_at,updated_at) VALUES('o','a','r','v','one-time','2026-09-07','2026-09-07','scheduled',?,'x','x')").run(prescription);
    const workspace = service.get(testUsers.trainerA, 'r');
    assert.equal(workspace.workout, null);
    assert.equal(workspace.occurrences.length, 1);
    assert.equal(workspace.today.state, 'scheduled');
    assert.equal(workspace.today.workoutName, 'Full Body');
  } finally { store.close(); }
});
