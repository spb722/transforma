import crypto from 'node:crypto';
import { authorizeRelationship } from './access.js';
import { addDays, dateInZone, isoWeekday, validIsoDate } from './dates.js';
import { expectedVersion, HttpError } from './validation.js';
import { validateWorkoutPrescription } from './plans.js';

const shape = row => {
  const overridden = row.prescription_override_json || null;
  return ({
  id: row.id, assignmentId: row.assignment_id, relationshipId: row.relationship_id,
  revisionId: row.revision_id, recurrenceKey: row.recurrence_key,
  scheduledDate: row.scheduled_date, originalDate: row.original_date,
  overrideDate: row.override_date, state: row.state,
  cancellationReason: row.cancellation_reason || null,
  prescription: JSON.parse(overridden || row.prescription_json),
  customized: !!overridden, customizedAt: row.override_updated_at || null,
  version: row.version
  });
};

const prescription = (result, day) => JSON.stringify({
  planName: result.content.name, dayId: day.id, dayName: day.name,
  unit: result.content.unit, exercises: day.exercises
});

export function occurrenceService(store, { now = () => new Date() } = {}) {
  const event = (row, actorId, type, fromDate, toDate, at) => store.db.prepare(
    'INSERT INTO occurrence_events (id,occurrence_id,actor_id,type,from_date,to_date,created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(crypto.randomUUID(), row.id, actorId, type, fromDate, toDate, at);

  const assignmentContext = assignmentId => store.db.prepare(`SELECT a.id AS assignment_id,a.current_revision_id,r.content_json,
      c.id AS relationship_id,c.trainer_id,c.client_id,c.status,c.time_zone
    FROM plan_assignments a
    JOIN plan_revisions r ON r.id=a.current_revision_id
    JOIN client_relationships c ON c.id=a.relationship_id
    WHERE a.id=? AND a.kind='workout'`).get(assignmentId);

  const naturalCollision = (row, target) => {
    const context = assignmentContext(row.assignment_id);
    if (!context) return false;
    const content = JSON.parse(context.content_json);
    const matchingDay = content.days.find(day => day.weekdays.includes(isoWeekday(target)));
    return !!matchingDay && `${matchingDay.id}:${target}` !== row.recurrence_key;
  };

  const loadWritable = (user, occurrenceId) => {
    const row = store.db.prepare(`SELECT o.*,r.trainer_id,r.client_id,r.status AS relationship_status,r.time_zone
      FROM workout_occurrences o JOIN client_relationships r ON r.id=o.relationship_id WHERE o.id=?`).get(occurrenceId);
    authorizeRelationship(user, row && { ...row, id: row.relationship_id, status: row.relationship_status }, 'write-trainer');
    return row;
  };

  const assertMutable = (row, version, { canceled = false } = {}) => {
    const today = dateInZone(now(), row.time_zone);
    const allowedState = canceled ? row.state === 'canceled' : row.state === 'scheduled';
    if (!allowedState || row.scheduled_date < today) throw new HttpError(409, 'OCCURRENCE_LOCKED', 'Past, started, or completed sessions cannot change');
    if (row.version !== version) throw new HttpError(409, 'VERSION_CONFLICT', 'Reload this occurrence before changing it');
    return today;
  };

  const assertAvailableDate = (row, target) => {
    const duplicate = store.db.prepare("SELECT id FROM workout_occurrences WHERE assignment_id=? AND scheduled_date=? AND id<>? AND state<>'canceled'").get(row.assignment_id, target, row.id);
    if (duplicate || naturalCollision(row, target)) throw new HttpError(409, 'DATE_OCCUPIED', 'Another assigned session uses this date');
  };

  const service = {
    reconcile(result, relationship) {
      if (result.kind !== 'workout') return;
      const today = dateInZone(now(), relationship.time_zone);
      const through = addDays(today, 28);
      const at = now().toISOString();
      const desired = new Map();

      for (let date = today; date <= through; date = addDays(date, 1)) {
        const day = result.content.days.find(item => item.weekdays.includes(isoWeekday(date)));
        if (day) desired.set(`${day.id}:${date}`, { date, day });
      }

      const existingRows = store.db.prepare(`SELECT * FROM workout_occurrences
        WHERE assignment_id=? AND original_date BETWEEN ? AND ?`).all(result.id, today, through);
      const desiredDayIds = new Set(result.content.days.map(day => day.id));
      const claimed = new Set();
      const matches = new Map();
      const priority = row => ['started', 'completed'].includes(row.state) ? 0
        : row.state === 'scheduled' ? 1
          : row.cancellation_reason === 'explicit' ? 2 : 3;

      // A source/template switch normally generates new day IDs. Match by the stable
      // original business date so future rows are updated in place instead of colliding
      // with the schedule they are replacing. Locked rows win and remain untouched.
      for (const [key, wanted] of desired) {
        const candidates = existingRows
          .filter(row => row.original_date === wanted.date && !claimed.has(row.id))
          .sort((a, b) => priority(a) - priority(b) || Number(b.recurrence_key === key) - Number(a.recurrence_key === key));
        const match = candidates[0] || null;
        if (match) claimed.add(match.id);
        matches.set(key, match);
      }

      // Retire obsolete rows before inserting new dates. Explicit days off remain only
      // while their recurring training-day identity still exists in the revised plan.
      for (const row of existingRows) {
        if (claimed.has(row.id) || ['started', 'completed'].includes(row.state)) continue;
        const dayId = row.recurrence_key.slice(0, row.recurrence_key.lastIndexOf(':'));
        const retiresExplicitDayOff = row.state === 'canceled' && row.cancellation_reason === 'explicit' && !desiredDayIds.has(dayId);
        if (row.state !== 'scheduled' && !retiresExplicitDayOff) continue;
        store.db.prepare("UPDATE workout_occurrences SET state='canceled',cancellation_reason='plan_removed',version=version+1,updated_at=? WHERE id=?").run(at, row.id);
        event(row, relationship.trainer_id, 'plan_removed', row.scheduled_date, null, at);
      }

      for (const [key, wanted] of desired) {
        const existing = matches.get(key);
        const nextPrescription = prescription(result, wanted.day);
        if (!existing) {
          const occupied = store.db.prepare("SELECT id FROM workout_occurrences WHERE assignment_id=? AND scheduled_date=? AND state<>'canceled'").get(result.id, wanted.date);
          if (occupied) throw new HttpError(409, 'DATE_OCCUPIED', `Another assigned session uses ${wanted.date}`);
          store.db.prepare(`INSERT INTO workout_occurrences
            (id,assignment_id,relationship_id,revision_id,recurrence_key,scheduled_date,original_date,prescription_json,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)`).run(crypto.randomUUID(), result.id, relationship.id, result.revisionId, key, wanted.date, wanted.date, nextPrescription, at, at);
          continue;
        }
        if (['started', 'completed'].includes(existing.state)) continue;
        const nextOverride = existing.prescription_override_json
          ? JSON.stringify({ ...JSON.parse(existing.prescription_override_json), planName: result.content.name, dayId: wanted.day.id })
          : null;
        if (existing.state === 'scheduled') {
          const changed = existing.recurrence_key !== key || existing.revision_id !== result.revisionId
            || existing.prescription_json !== nextPrescription || (existing.prescription_override_json || null) !== nextOverride;
          if (changed) store.db.prepare(`UPDATE workout_occurrences
            SET recurrence_key=?,revision_id=?,prescription_json=?,prescription_override_json=?,updated_at=?,version=version+1 WHERE id=?`)
            .run(key, result.revisionId, nextPrescription, nextOverride, at, existing.id);
        } else if (existing.cancellation_reason === 'plan_removed') {
          const duplicate = store.db.prepare("SELECT id FROM workout_occurrences WHERE assignment_id=? AND scheduled_date=? AND id<>? AND state<>'canceled'").get(result.id, existing.scheduled_date, existing.id);
          if (duplicate) throw new HttpError(409, 'DATE_OCCUPIED', `Another assigned session uses ${existing.scheduled_date}`);
          store.db.prepare(`UPDATE workout_occurrences SET state='scheduled',cancellation_reason=NULL,recurrence_key=?,revision_id=?,
            prescription_json=?,prescription_override_json=?,updated_at=?,version=version+1 WHERE id=?`)
            .run(key, result.revisionId, nextPrescription, nextOverride, at, existing.id);
          event(existing, relationship.trainer_id, 'plan_restored', existing.scheduled_date, existing.scheduled_date, at);
        } else if (existing.cancellation_reason === 'explicit') {
          const changed = existing.recurrence_key !== key || existing.revision_id !== result.revisionId
            || existing.prescription_json !== nextPrescription || (existing.prescription_override_json || null) !== nextOverride;
          if (changed) store.db.prepare(`UPDATE workout_occurrences SET recurrence_key=?,revision_id=?,prescription_json=?,
            prescription_override_json=?,updated_at=?,version=version+1 WHERE id=?`)
            .run(key, result.revisionId, nextPrescription, nextOverride, at, existing.id);
        }
      }
      store.db.prepare('UPDATE plan_assignments SET materialized_through=? WHERE id=?').run(through, result.id);
    },

    catchUpAssignment(assignmentId) {
      const row = assignmentContext(assignmentId);
      if (!row || row.status !== 'active') return false;
      service.reconcile({ id: row.assignment_id, kind: 'workout', revisionId: row.current_revision_id, content: JSON.parse(row.content_json) }, { ...row, id: row.relationship_id });
      return true;
    },

    catchUpRelationship(relationshipId) {
      const rows = store.db.prepare("SELECT id FROM plan_assignments WHERE relationship_id=? AND kind='workout'").all(relationshipId);
      for (const row of rows) service.catchUpAssignment(row.id);
      return rows.length;
    },

    catchUpAll() {
      const rows = store.db.prepare(`SELECT a.id FROM plan_assignments a JOIN client_relationships c ON c.id=a.relationship_id
        WHERE a.kind='workout' AND c.status='active'`).all();
      for (const row of rows) service.catchUpAssignment(row.id);
      return rows.length;
    },

    list(user, relationshipId, { from, to } = {}) {
      const relationship = store.db.prepare('SELECT * FROM client_relationships WHERE id=?').get(relationshipId);
      authorizeRelationship(user, relationship, 'read');
      service.catchUpRelationship(relationshipId);
      const start = from || '0000-01-01';
      const end = to || '9999-12-31';
      return store.db.prepare('SELECT * FROM workout_occurrences WHERE relationship_id=? AND scheduled_date BETWEEN ? AND ? ORDER BY scheduled_date').all(relationshipId, start, end).map(shape);
    },

    move(user, occurrenceId, requestedVersion, scheduledDate) {
      const version = expectedVersion(requestedVersion);
      const row = loadWritable(user, occurrenceId);
      const today = assertMutable(row, version);
      const target = scheduledDate === null ? row.original_date : scheduledDate;
      if (!validIsoDate(target) || target < today) throw new HttpError(422, 'VALIDATION_ERROR', 'Choose today or a future date');
      if (target === row.scheduled_date && (scheduledDate !== null || row.override_date === null)) return shape(row);
      assertAvailableDate(row, target);
      const at = now().toISOString();
      store.db.prepare('UPDATE workout_occurrences SET scheduled_date=?,override_date=?,version=version+1,updated_at=? WHERE id=?')
        .run(target, scheduledDate === null ? null : target, at, row.id);
      event(row, user.id, scheduledDate === null ? 'reset' : 'moved', row.scheduled_date, target, at);
      return shape(store.db.prepare('SELECT * FROM workout_occurrences WHERE id=?').get(row.id));
    },

    reset(user, occurrenceId, requestedVersion) {
      return service.move(user, occurrenceId, requestedVersion, null);
    },

    customize(user, occurrenceId, requestedVersion, override) {
      const version = expectedVersion(requestedVersion);
      const row = loadWritable(user, occurrenceId);
      assertMutable(row, version);
      const base = JSON.parse(row.prescription_json);
      const next = override === null ? null : JSON.stringify(validateWorkoutPrescription(override, base));
      if ((row.prescription_override_json || null) === next) return shape(row);
      const at = now().toISOString();
      store.db.prepare('UPDATE workout_occurrences SET prescription_override_json=?,override_updated_at=?,version=version+1,updated_at=? WHERE id=?')
        .run(next, next ? at : null, at, row.id);
      event(row, user.id, next ? 'customized' : 'customization_reset', row.scheduled_date, row.scheduled_date, at);
      return shape(store.db.prepare('SELECT * FROM workout_occurrences WHERE id=?').get(row.id));
    },

    cancel(user, occurrenceId, requestedVersion) {
      const version = expectedVersion(requestedVersion);
      const row = loadWritable(user, occurrenceId);
      assertMutable(row, version);
      const at = now().toISOString();
      store.db.prepare("UPDATE workout_occurrences SET state='canceled',cancellation_reason='explicit',version=version+1,updated_at=? WHERE id=?").run(at, row.id);
      event(row, user.id, 'canceled', row.scheduled_date, null, at);
      return shape(store.db.prepare('SELECT * FROM workout_occurrences WHERE id=?').get(row.id));
    },

    restore(user, occurrenceId, requestedVersion, scheduledDate) {
      const version = expectedVersion(requestedVersion);
      const row = loadWritable(user, occurrenceId);
      const today = assertMutable(row, version, { canceled: true });
      if (row.cancellation_reason !== 'explicit') throw new HttpError(409, 'OCCURRENCE_LOCKED', 'Only an explicitly canceled session can be restored');
      const target = scheduledDate || row.scheduled_date;
      if (!validIsoDate(target) || target < today) throw new HttpError(422, 'VALIDATION_ERROR', 'Choose today or a future date');
      assertAvailableDate(row, target);
      const at = now().toISOString();
      store.db.prepare("UPDATE workout_occurrences SET state='scheduled',cancellation_reason=NULL,scheduled_date=?,override_date=CASE WHEN ?=original_date THEN NULL ELSE ? END,version=version+1,updated_at=? WHERE id=?")
        .run(target, target, target, at, row.id);
      event(row, user.id, 'restored', row.scheduled_date, target, at);
      return shape(store.db.prepare('SELECT * FROM workout_occurrences WHERE id=?').get(row.id));
    },

    endRelationship(relationship) {
      const today = dateInZone(now(), relationship.time_zone);
      const at = now().toISOString();
      const rows = store.db.prepare("SELECT * FROM workout_occurrences WHERE relationship_id=? AND state='scheduled' AND scheduled_date>=?").all(relationship.id, today);
      for (const row of rows) {
        store.db.prepare("UPDATE workout_occurrences SET state='canceled',cancellation_reason='relationship_ended',version=version+1,updated_at=? WHERE id=?").run(at, row.id);
        event(row, relationship.ended_by || relationship.trainer_id, 'relationship_ended', row.scheduled_date, null, at);
      }
    }
  };
  return service;
}
