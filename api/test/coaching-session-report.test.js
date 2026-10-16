import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionReport } from '../coaching/session-report.js';
import { progressService } from '../coaching/progress.js';
import { openCoachingDb } from '../coaching/db.js';
import { tempCoachingData, identityAuthority, testUsers } from './coaching-helpers.mjs';

const prescription = { dayName: 'Full Body', unit: 'kg', exercises: [
  { entryId: 'squat', exerciseId: 'squat', name: 'Goblet squat', mode: 'reps', sets: [{ weight: 20, reps: 8 }, { weight: 20, reps: 8 }, { weight: 20, reps: 8 }] },
  { entryId: 'hold', exerciseId: 'squat', name: 'Squat hold', mode: 'time', sets: [{ seconds: 30 }] },
  { entryId: 'cardio', exerciseId: 'treadmill', name: 'Treadmill', mode: 'cardio', sets: [{ minutes: 15, speed: 6 }] }
] };
const row = (overrides = {}) => ({ id: 's', occurrence_id: 'o', scheduled_date: '2026-09-07', state: 'finished', unit: 'kg', time_zone: 'UTC', started_at: '2026-09-07T08:00:00Z', client_finished_at: '2026-09-07T08:30:00Z', received_at: '2026-09-07T08:40:00Z', prescription_json: JSON.stringify(prescription), actual_json: JSON.stringify({ unit: 'lb', entries: [
  { entryId: 'hold', id: 'squat', sets: [{ sec: 30, done: true }] },
  { entryId: 'squat', id: 'squat', sets: [{ w: 44, r: 8, done: true }, { w: 44, r: 8, done: true }, { w: 44, r: 6, done: true }] }
] }), ...overrides });

test('report preserves target order and units, compares every set, and shows omitted exercise', () => {
  const report = sessionReport(row());
  assert.equal(report.workoutName, 'Full Body');
  assert.equal(report.exercises[0].sets[2].prescribed.reps, 8);
  assert.equal(report.exercises[0].sets[2].actual.r, 6);
  assert.equal(report.exercises[1].sets[0].actual.sec, 30);
  assert.equal(report.exercises[2].sets[0].status, 'skipped');
  assert.equal(report.completedSets, 4);
  assert.equal(report.skippedSets, 1);
  assert.equal(report.classification, 'partial');
  assert.equal(report.durationSeconds, 1800);
  assert.equal(report.unit, 'kg');
  assert.equal(report.actualUnit, 'lb');
  assert.equal(report.syncStatus, 'received');
});

test('unfinished presets never become actual values; unsynced starts do not claim skipped work', () => {
  const report = sessionReport(row({ state: 'started', received_at: null, client_finished_at: null, actual_json: null }));
  assert.equal(report.classification, 'in_progress');
  assert.equal(report.syncStatus, 'awaiting_result');
  assert.equal(report.skippedSets, 0);
  assert.equal(report.durationSeconds, null);
  assert.equal(report.exercises[0].sets[0].status, 'pending');
  const empty = sessionReport(row({ actual_json: JSON.stringify({ entries: [{ entryId: 'squat', id: 'squat', sets: [{ w: 20, r: 8, done: false }] }] }) }));
  assert.equal(empty.classification, 'zero');
  assert.equal(empty.exercises[0].sets[0].actual, null);
});

test('extra actual sets stay visible without masking skipped prescribed sets', () => {
  const report = sessionReport(row({ summary_json: '{"classification":"extra"}', actual_json: JSON.stringify({ entries: [{ entryId: 'squat', id: 'squat', sets: Array.from({ length: 5 }, () => ({ w: 20, r: 8, done: true })) }] }) }), 2);
  assert.equal(report.attempt, 2);
  assert.equal(report.extra, true);
  assert.equal(report.classification, 'partial');
  assert.equal(report.exercises[0].sets[4].prescribed, null);
  assert.equal(report.skippedSets, 2);
});

test('progress keeps attempts separate, counts day once and enforces relationship access', () => {
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities: identityAuthority() });
  try {
    store.insertRelationship({ id: 'r', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'yes', now: '2026-09-01T00:00:00Z' });
    store.db.prepare("INSERT INTO plan_assignments(id,relationship_id,kind,version,created_at,updated_at) VALUES('a','r','workout',1,'x','x')").run();
    store.db.prepare("INSERT INTO plan_revisions(id,assignment_id,revision_number,content_json,published_by,published_at) VALUES('v','a',1,'{}','trainer-a','x')").run();
    store.db.prepare("INSERT INTO workout_occurrences(id,assignment_id,relationship_id,revision_id,recurrence_key,scheduled_date,original_date,state,prescription_json,created_at,updated_at) VALUES('o','a','r','v','k','2026-09-07','2026-09-07','completed','{}','x','x')").run();
    for (const id of ['s1', 's2']) store.db.prepare("INSERT INTO assigned_sessions(id,occurrence_id,relationship_id,client_id,revision_id,state,started_at,client_finished_at,received_at,scheduled_date,time_zone,unit,prescription_json,actual_json,summary_json) VALUES(?,'o','r','client-a','v','finished','2026-09-07T08:00:00Z','2026-09-07T08:30:00Z','2026-09-07T08:40:00Z','2026-09-07','UTC','kg',?,?,'{}')").run(id, row().prescription_json, row().actual_json);
    const service = progressService(store);
    const data = service.get(testUsers.trainerA, 'r');
    assert.equal(data.completed, 1);
    assert.equal(data.scheduled, 1);
    assert.deepEqual(data.sessions.map(item => item.attempt), [2, 1]);
    assert.equal(service.get(testUsers.clientA, 'r').sessions.length, 2);
    assert.throws(() => service.get(testUsers.trainerB, 'r'), error => error.status === 404);
    assert.throws(() => service.get(testUsers.clientB, 'r'), error => error.status === 404);
  } finally { store.close(); }
});
