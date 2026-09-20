import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempCoachingData, identityAuthority, testUsers } from './coaching-helpers.mjs';

const { openCoachingDb } = await import('../coaching/db.js');
const { sessionService } = await import('../coaching/sessions.js');

test('migrations create a durable WAL database without touching legacy identity data', () => {
  const dataDir = tempCoachingData();
  const identityBefore = fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8');
  let store = openCoachingDb({ dataDir, identities: identityAuthority() });
  assert.equal(store.db.pragma('foreign_keys', { simple: true }), 1);
  assert.equal(store.db.pragma('journal_mode', { simple: true }), 'wal');
  assert.equal(store.db.pragma('synchronous', { simple: true }), 2);
  assert.ok(store.appliedVersions().includes(1));
  store.db.prepare('INSERT INTO trainer_profiles (user_id, display_name, business_time_zone, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)')
    .run(testUsers.trainerA.id, 'Trainer A', 'Asia/Kolkata', '2026-09-07T00:00:00.000Z', '2026-09-07T00:00:00.000Z');
  store.close();

  store = openCoachingDb({ dataDir, identities: identityAuthority() });
  assert.equal(store.db.prepare('SELECT display_name FROM trainer_profiles WHERE user_id = ?').get(testUsers.trainerA.id).display_name, 'Trainer A');
  store.close();
  assert.equal(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'), identityBefore);
});

test('foreign keys, one-active-trainer constraint, and transactions fail atomically', () => {
  const dataDir = tempCoachingData();
  const store = openCoachingDb({ dataDir, identities: identityAuthority() });
  assert.throws(() => store.assertAccount('missing'), /account unavailable/);
  assert.throws(() => store.db.prepare("INSERT INTO client_relationships (id, trainer_id, client_id, status, time_zone, consent_version, consent_text_snapshot, consented_at, started_at, version) VALUES ('r-bad','missing','client-a','active','UTC',1,'x','x','x',1)").run(), /account unavailable/);

  store.transaction(() => {
    store.insertRelationship({ id: 'r1', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'Share history', now: '2026-09-07T00:00:00.000Z' });
  })();
  assert.throws(() => store.insertRelationship({ id: 'r2', trainerId: testUsers.trainerB.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'Share history', now: '2026-09-07T00:00:00.000Z' }), /active trainer/i);

  assert.throws(() => store.transaction(() => {
    store.db.prepare("INSERT INTO trainer_profiles (user_id, display_name, business_time_zone, version, created_at, updated_at) VALUES ('trainer-b','B','UTC',1,'x','x')").run();
    throw new Error('stop');
  })(), /stop/);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM trainer_profiles WHERE user_id='trainer-b'").get().n, 0);
  store.close();
});

test('a failed migration or corrupt database stops startup instead of replacing data', () => {
  const dataDir = tempCoachingData();
  const migrationDir = fs.mkdtempSync(path.join(dataDir, 'bad-migrations-'));
  fs.writeFileSync(path.join(migrationDir, '001_bad.sql'), 'CREATE TABLE first_table (id TEXT PRIMARY KEY); THIS IS NOT SQL;');
  assert.throws(() => openCoachingDb({ dataDir, migrationsDir: migrationDir, identities: identityAuthority() }), /migration 1 failed/i);

  const corruptDir = tempCoachingData();
  fs.writeFileSync(path.join(corruptDir, 'coaching.sqlite'), 'not a database');
  assert.throws(() => openCoachingDb({ dataDir: corruptDir, identities: identityAuthority() }), /not a database|malformed/i);
  assert.equal(fs.readFileSync(path.join(corruptDir, 'coaching.sqlite'), 'utf8'), 'not a database');
});

test('a stopped whole-data backup restores identities and coaching records together', () => {
  const source = tempCoachingData();
  let store = openCoachingDb({ dataDir: source, identities: identityAuthority() });
  store.insertRelationship({ id: 'restore-r', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'Share history', now: '2026-09-07T00:00:00.000Z' });
  store.db.prepare("INSERT INTO plan_assignments(id,relationship_id,kind,version,created_at,updated_at) VALUES('restore-a','restore-r','workout',1,'x','x')").run();
  store.db.prepare("INSERT INTO plan_revisions(id,assignment_id,revision_number,content_json,published_by,published_at) VALUES('restore-v','restore-a',1,?,'trainer-a','x')").run(JSON.stringify({ dayName: 'Backup day', unit: 'kg', exercises: [{ id: 'squat', name: 'Squat', mode: 'reps', sets: [{ reps: 5, weight: 60 }] }] }));
  store.db.prepare("UPDATE plan_assignments SET current_revision_id='restore-v' WHERE id='restore-a'").run();
  store.db.prepare("INSERT INTO workout_occurrences(id,assignment_id,relationship_id,revision_id,recurrence_key,scheduled_date,original_date,state,prescription_json,created_at,updated_at) VALUES('restore-o','restore-a','restore-r','restore-v','restore-k','2026-09-07','2026-09-07','started',?,'x','x')").run(JSON.stringify({ dayName: 'Backup day', unit: 'kg', exercises: [{ id: 'squat', name: 'Squat', mode: 'reps', sets: [{ reps: 5, weight: 60 }] }] }));
  const pendingSession = '33333333-3333-4333-8333-333333333333';
  store.db.prepare("INSERT INTO assigned_sessions(id,occurrence_id,relationship_id,client_id,revision_id,state,started_at,scheduled_date,time_zone,unit,prescription_json) VALUES(?,'restore-o','restore-r','client-a','restore-v','started','x','2026-09-07','UTC','kg',?)").run(pendingSession, JSON.stringify({ dayName: 'Backup day', unit: 'kg', exercises: [{ id: 'squat', name: 'Squat', mode: 'reps', sets: [{ reps: 5, weight: 60 }] }] }));
  store.db.prepare("INSERT INTO fees(id,relationship_id,amount_minor,currency,exponent,period_start,period_end,due_date,time_zone,payment_url,payment_host,status,version,created_by,created_at,updated_at) VALUES('restore-fee','restore-r',5000,'INR',2,'2026-09-01','2026-09-30','2026-09-07','UTC','https://pay.example.test/f','pay.example.test','unpaid',1,'trainer-a','x','x')").run();
  store.db.prepare("INSERT INTO fee_events(id,fee_id,type,actor_id,created_at) VALUES('restore-event','restore-fee','created','trainer-a','x')").run();
  fs.writeFileSync(path.join(source, 'state-client-a.json'), JSON.stringify({ workouts: [{ id: 'legacy', d: '2026-09-01' }] }));
  store.close();
  const restored = fs.mkdtempSync(path.join(path.dirname(source), 'transforma-restored-'));
  fs.cpSync(source, restored, { recursive: true });
  store = openCoachingDb({ dataDir: restored, identities: identityAuthority() });
  assert.equal(store.db.prepare('SELECT client_id FROM client_relationships WHERE id=?').get('restore-r').client_id, testUsers.clientA.id);
  assert.equal(JSON.parse(fs.readFileSync(path.join(restored, 'state-client-a.json'))).workouts[0].id, 'legacy');
  assert.equal(fs.readFileSync(path.join(restored, 'db.json'), 'utf8'), fs.readFileSync(path.join(source, 'db.json'), 'utf8'));
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM fee_events WHERE fee_id='restore-fee'").get().n, 1);
  assert.equal(JSON.parse(store.db.prepare("SELECT prescription_json FROM assigned_sessions WHERE id=?").get(pendingSession).prescription_json).dayName, 'Backup day');
  const replayed = sessionService(store, { now: () => new Date('2026-09-07T08:00:00Z') }).finish(testUsers.clientA, { sessionId: pendingSession, state: 'finished', clientFinishedAt: '2026-09-07T07:30:00Z', actualWorkout: { id: pendingSession, unit: 'kg', entries: [{ id: 'squat', sets: [{ w: 60, r: 5, done: true }] }] } });
  assert.equal(replayed.summary.classification, 'completed');
  store.close();
});
