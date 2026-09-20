import test from 'node:test';
import assert from 'node:assert/strict';
import { tempCoachingData, identityAuthority, fixedClock, testUsers } from './coaching-helpers.mjs';
import { openCoachingDb } from '../coaching/db.js';
import { profileService } from '../coaching/profiles.js';
import { invitationService, CONSENT_VERSION } from '../coaching/invitations.js';
import { planService, validateWorkoutContent } from '../coaching/plans.js';
import { occurrenceService } from '../coaching/occurrences.js';

function fixture() {
  const identities = identityAuthority(); const store = openCoachingDb({ dataDir: tempCoachingData(), identities });
  const now = fixedClock(); const config = { trainerIds: new Set([testUsers.trainerA.id, testUsers.trainerB.id]) };
  profileService(store, { config, now }).save(testUsers.trainerA.id, { expectedVersion: 0, displayName: 'Coach', businessTimeZone: 'Asia/Kolkata' });
  const invites = invitationService(store, { config, now }); const token = invites.create(testUsers.trainerA.id).token;
  const relationship = invites.accept(token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true });
  const occurrences = occurrenceService(store, { now });
  const plans = planService(store, { now, validateContent: (kind, value) => kind === 'workout' ? validateWorkoutContent(value) : value, afterPublish: occurrences.reconcile });
  return { store, relationship, plans, occurrences };
}

const workout = { name: 'Strength week', unit: 'kg', days: [{ id: 'push', name: 'Push', weekdays: [1, 3], exercises: [{ id: 'bench', name: 'Bench press', mode: 'reps', sets: [{ reps: 8, weight: 40 }], restSec: 90, notes: '' }] }] };

test('workout publication creates an isolated immutable revision and 28-day occurrences', () => {
  const fx = fixture();
  const first = fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 0, content: workout });
  assert.equal(first.version, 1); assert.equal(first.content.days[0].exercises[0].name, 'Bench press');
  const rows = fx.store.db.prepare('SELECT * FROM workout_occurrences WHERE assignment_id = ?').all(first.id);
  assert.ok(rows.length >= 8); assert.ok(rows.every(row => JSON.parse(row.prescription_json).exercises[0].sets[0].weight === 40));
  const revised = structuredClone(workout); revised.days[0].exercises[0].sets[0].weight = 42.5;
  fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 1, content: revised });
  assert.equal(JSON.parse(fx.store.db.prepare('SELECT content_json FROM plan_revisions WHERE id = ?').get(first.revisionId).content_json).days[0].exercises[0].sets[0].weight, 40);
  assert.throws(() => fx.plans.publish(testUsers.clientA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 2, content: workout }), e => e.status === 404);
  fx.store.close();
});

test('future occurrences move and cancel with stable ids while locked dates reject changes', () => {
  const fx = fixture(); const published = fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 0, content: workout });
  const row = fx.store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id = ? AND scheduled_date > '2026-09-07' ORDER BY scheduled_date LIMIT 1").get(published.id);
  const moved = fx.occurrences.move(testUsers.trainerA, row.id, row.version, '2026-09-12');
  assert.equal(moved.id, row.id); assert.equal(moved.scheduledDate, '2026-09-12');
  const canceled = fx.occurrences.cancel(testUsers.trainerA, row.id, moved.version); assert.equal(canceled.state, 'canceled');
  assert.throws(() => fx.occurrences.move(testUsers.trainerA, row.id, canceled.version, '2026-09-13'), e => e.code === 'OCCURRENCE_LOCKED');
  fx.store.close();
});

test('restart catch-up materializes downtime dates and restores a rolling 28-day horizon', () => {
  const identities = identityAuthority(); const store = openCoachingDb({ dataDir: tempCoachingData(), identities });
  let instant = new Date('2026-09-07T06:30:00Z'); const now = () => new Date(instant); const config = { trainerIds: new Set([testUsers.trainerA.id]) };
  profileService(store, { config, now }).save(testUsers.trainerA.id, { expectedVersion: 0, displayName: 'Coach', businessTimeZone: 'Asia/Kolkata' });
  const invitations = invitationService(store, { config, now }); const relationship = invitations.accept(invitations.create(testUsers.trainerA.id).token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true });
  const occurrences = occurrenceService(store, { now }); const plans = planService(store, { now, validateContent: (_kind, value) => validateWorkoutContent(value), afterPublish: occurrences.reconcile });
  const published = plans.publish(testUsers.trainerA.id, { relationshipId: relationship.id, kind: 'workout', expectedVersion: 0, content: workout });
  const toMove = store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id=? AND scheduled_date='2026-09-09'").get(published.id);
  const moved = occurrences.move(testUsers.trainerA, toMove.id, toMove.version, '2026-11-03');
  instant = new Date('2026-10-20T06:30:00Z');
  assert.equal(occurrences.catchUpAll(), 1);
  assert.ok(store.db.prepare("SELECT id FROM workout_occurrences WHERE assignment_id=? AND scheduled_date='2026-10-05'").get(published.id));
  assert.equal(store.db.prepare("SELECT id,count(*) AS n FROM workout_occurrences WHERE assignment_id=? AND scheduled_date='2026-11-03'").get(published.id).id, moved.id);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM workout_occurrences WHERE assignment_id=? AND scheduled_date='2026-11-03'").get(published.id).n, 1);
  assert.equal(store.db.prepare('SELECT materialized_through FROM plan_assignments WHERE id=?').get(published.id).materialized_through, '2026-11-17');
  const count = store.db.prepare('SELECT count(*) AS n FROM workout_occurrences WHERE assignment_id=?').get(published.id).n;
  occurrences.catchUpAll();
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM workout_occurrences WHERE assignment_id=?').get(published.id).n, count);
  store.close();
});

test('plan reconciliation removes and restores future weekdays without overriding explicit cancellation', () => {
  const fx = fixture();
  const published = fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 0, content: workout });
  const monday = fx.store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id=? AND original_date='2026-09-07'").get(published.id);
  const wednesday = fx.store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id=? AND original_date='2026-09-09'").get(published.id);
  fx.occurrences.cancel(testUsers.trainerA, wednesday.id, wednesday.version);

  const fridayOnly = structuredClone(workout);
  fridayOnly.days[0].weekdays = [5];
  fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 1, content: fridayOnly });
  const removed = fx.store.db.prepare('SELECT * FROM workout_occurrences WHERE id=?').get(monday.id);
  assert.equal(removed.state, 'canceled');
  assert.equal(removed.cancellation_reason, 'plan_removed');

  fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 2, content: workout });
  const restored = fx.store.db.prepare('SELECT * FROM workout_occurrences WHERE id=?').get(monday.id);
  const stillExplicit = fx.store.db.prepare('SELECT * FROM workout_occurrences WHERE id=?').get(wednesday.id);
  assert.equal(restored.state, 'scheduled');
  assert.equal(restored.id, monday.id);
  assert.equal(restored.cancellation_reason, null);
  assert.equal(stillExplicit.state, 'canceled');
  assert.equal(stillExplicit.cancellation_reason, 'explicit');
  const stableVersion = stillExplicit.version;
  fx.occurrences.list(testUsers.clientA, fx.relationship.id);
  assert.equal(fx.store.db.prepare('SELECT version FROM workout_occurrences WHERE id=?').get(wednesday.id).version, stableVersion);
  fx.store.close();
});

test('cancel restore reset and no-op moves retain one stable occurrence', () => {
  const fx = fixture();
  const published = fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 0, content: workout });
  const row = fx.store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id=? AND original_date='2026-09-09'").get(published.id);
  const unchanged = fx.occurrences.move(testUsers.trainerA, row.id, row.version, row.scheduled_date);
  assert.equal(unchanged.version, row.version);
  const moved = fx.occurrences.move(testUsers.trainerA, row.id, row.version, '2026-09-12');
  const reset = fx.occurrences.reset(testUsers.trainerA, row.id, moved.version);
  assert.equal(reset.scheduledDate, row.original_date);
  assert.equal(reset.overrideDate, null);
  const canceled = fx.occurrences.cancel(testUsers.trainerA, row.id, reset.version);
  const restored = fx.occurrences.restore(testUsers.trainerA, row.id, canceled.version, '2026-09-13');
  assert.equal(restored.id, row.id);
  assert.equal(restored.state, 'scheduled');
  assert.equal(restored.scheduledDate, '2026-09-13');
  assert.equal(fx.store.db.prepare('SELECT count(*) AS n FROM workout_occurrences WHERE id=?').get(row.id).n, 1);
  fx.store.close();
});

test('one-day workout edits stay isolated and reset to the latest recurring prescription', () => {
  const fx = fixture();
  const published = fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 0, content: workout });
  const row = fx.store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id=? AND original_date='2026-09-09'").get(published.id);
  const oneDay = JSON.parse(row.prescription_json);
  oneDay.dayName = 'Travel-friendly Push';
  oneDay.exercises[0].sets[0].weight = 25;

  const customized = fx.occurrences.customize(testUsers.trainerA, row.id, row.version, oneDay);
  assert.equal(customized.customized, true);
  assert.equal(customized.prescription.dayName, 'Travel-friendly Push');
  assert.equal(customized.prescription.exercises[0].sets[0].weight, 25);
  const stored = fx.store.db.prepare('SELECT prescription_json,prescription_override_json FROM workout_occurrences WHERE id=?').get(row.id);
  assert.equal(JSON.parse(stored.prescription_json).exercises[0].sets[0].weight, 40);
  assert.equal(JSON.parse(stored.prescription_override_json).exercises[0].sets[0].weight, 25);

  const revised = structuredClone(workout);
  revised.days[0].exercises[0].sets[0].weight = 45;
  fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 1, content: revised });
  const afterPublish = fx.occurrences.list(testUsers.trainerA, fx.relationship.id).find(item => item.id === row.id);
  assert.equal(afterPublish.customized, true);
  assert.equal(afterPublish.prescription.exercises[0].sets[0].weight, 25);

  const dayOff = fx.occurrences.cancel(testUsers.trainerA, row.id, afterPublish.version);
  const restored = fx.occurrences.restore(testUsers.trainerA, row.id, dayOff.version, row.scheduled_date);
  assert.equal(restored.customized, true);
  assert.equal(restored.prescription.dayName, 'Travel-friendly Push');

  const reset = fx.occurrences.customize(testUsers.trainerA, row.id, restored.version, null);
  assert.equal(reset.customized, false);
  assert.equal(reset.prescription.dayName, 'Push');
  assert.equal(reset.prescription.exercises[0].sets[0].weight, 45);
  assert.throws(() => fx.occurrences.customize(testUsers.clientA, row.id, reset.version, oneDay), error => error.status === 404);
  fx.store.db.prepare("UPDATE workout_occurrences SET state='started' WHERE id=?").run(row.id);
  assert.throws(() => fx.occurrences.customize(testUsers.trainerA, row.id, reset.version, oneDay), error => error.code === 'OCCURRENCE_LOCKED');
  fx.store.close();
});

test('publishing a plan with new day identities replaces the future schedule in place', () => {
  const fx = fixture();
  const everyDay = structuredClone(workout);
  everyDay.days[0].weekdays = [1, 2, 3, 4, 5, 6, 7];
  const published = fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 0, content: everyDay });
  const completed = fx.store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id=? AND original_date='2026-09-07'").get(published.id);
  fx.store.db.prepare("UPDATE workout_occurrences SET state='completed' WHERE id=?").run(completed.id);
  const retiredDayOff = fx.store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id=? AND original_date='2026-09-08'").get(published.id);
  fx.occurrences.cancel(testUsers.trainerA, retiredDayOff.id, retiredDayOff.version);
  const customizedRow = fx.store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id=? AND original_date='2026-09-14'").get(published.id);
  const custom = JSON.parse(customizedRow.prescription_json);
  custom.dayName = 'Travel Push';
  const customized = fx.occurrences.customize(testUsers.trainerA, customizedRow.id, customizedRow.version, custom);

  const starter = {
    name: 'Starter PPL', unit: 'kg', days: [
      { ...structuredClone(workout.days[0]), id: 'starter-push', name: 'Push Day', weekdays: [1] },
      { ...structuredClone(workout.days[0]), id: 'starter-pull', name: 'Pull Day', weekdays: [3] },
      { ...structuredClone(workout.days[0]), id: 'starter-legs', name: 'Leg Day', weekdays: [5] }
    ]
  };
  const revised = fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 1, content: starter });
  const rows = fx.store.db.prepare('SELECT * FROM workout_occurrences WHERE assignment_id=? ORDER BY original_date').all(published.id);
  const activeFuture = rows.filter(row => row.original_date > '2026-09-07' && row.state === 'scheduled');
  assert.ok(activeFuture.length > 0);
  assert.ok(activeFuture.every(row => ['starter-push', 'starter-pull', 'starter-legs'].includes(row.recurrence_key.split(':')[0])));
  assert.ok(activeFuture.every(row => JSON.parse(row.prescription_json).planName === 'Starter PPL'));
  assert.equal(rows.find(row => row.id === completed.id).state, 'completed');
  assert.equal(rows.find(row => row.id === retiredDayOff.id).cancellation_reason, 'plan_removed');
  const preserved = rows.find(row => row.id === customized.id);
  assert.equal(preserved.recurrence_key, 'starter-push:2026-09-14');
  assert.equal(preserved.state, 'scheduled');
  assert.equal(JSON.parse(preserved.prescription_json).dayName, 'Push Day');
  assert.equal(JSON.parse(preserved.prescription_override_json).dayName, 'Travel Push');
  assert.equal(JSON.parse(preserved.prescription_override_json).planName, 'Starter PPL');
  assert.equal(revised.content.name, 'Starter PPL');
  fx.store.close();
});

test('duplicate weekday ownership and predictable future move collisions are rejected', () => {
  const fx = fixture();
  const duplicate = structuredClone(workout);
  duplicate.days.push({ ...structuredClone(duplicate.days[0]), id: 'other', name: 'Other' });
  assert.throws(() => fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 0, content: duplicate }), error => error.code === 'VALIDATION_ERROR');

  const published = fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 0, content: workout });
  const row = fx.store.db.prepare("SELECT * FROM workout_occurrences WHERE assignment_id=? AND original_date='2026-09-09'").get(published.id);
  assert.throws(() => fx.occurrences.move(testUsers.trainerA, row.id, row.version, '2026-11-02'), error => error.code === 'DATE_OCCUPIED');
  fx.store.close();
});

test('legacy exercise ids normalize to separate stable entry and catalog identities', () => {
  const normalized = validateWorkoutContent(workout);
  const exercise = normalized.days[0].exercises[0];
  assert.equal(exercise.entryId, 'bench');
  assert.equal(exercise.exerciseId, 'bench');
  assert.equal(exercise.id, undefined);
  const custom = structuredClone(workout);
  custom.days[0].exercises[0] = { entryId: 'entry-1', exerciseId: 'custom-1', name: 'Band press', mode: 'reps', sets: [{ reps: 12, weight: 0 }], restSec: 45, notes: 'Slow lowering', custom: { muscle: 'Chest', equipment: 'Band' } };
  const customExercise = validateWorkoutContent(custom).days[0].exercises[0];
  assert.deepEqual(customExercise.custom, { muscle: 'Chest', equipment: 'Band' });
});

test('recent assignment sources are bounded and isolated to their trainer', () => {
  const fx = fixture();
  fx.plans.publish(testUsers.trainerA.id, { relationshipId: fx.relationship.id, kind: 'workout', expectedVersion: 0, content: workout });
  const own = fx.plans.sources(testUsers.trainerA.id, { limit: 1 });
  assert.equal(own.length, 1);
  assert.deepEqual(Object.keys(own[0]).sort(), ['clientName','content','id','planName','publishedAt','revisionId','sourceType']);
  assert.equal(own[0].clientName, testUsers.clientA.name);
  assert.equal(fx.plans.sources(testUsers.trainerB.id).length, 0);
  fx.store.close();
});
