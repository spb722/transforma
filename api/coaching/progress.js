import { addDays, dateInZone } from './dates.js';
import { HttpError } from './validation.js';
import { authorizeRelationship } from './access.js';
import { completedOccurrenceCount } from './result-counts.js';
import { sessionReport } from './session-report.js';

const parsed = (value, fallback) => { try { return JSON.parse(value || '') } catch { return fallback } };

function assignedStrength(sessions) {
  return sessions.flatMap(session => {
    const prescription = parsed(session.prescription_json, {});
    const actual = parsed(session.actual_json, {});
    const targets = new Map((prescription.exercises || []).flatMap(exercise => [
      [exercise.entryId || exercise.id, exercise],
      [exercise.exerciseId || exercise.id, exercise]
    ]));
    return (actual.entries || []).flatMap(entry => {
      const target = targets.get(entry.entryId || entry.id) || targets.get(entry.id) || {};
      if (target.mode && target.mode !== 'reps') return [];
      return (entry.sets || []).filter(set => set.done && Number.isFinite(Number(set.w)) && Number.isFinite(Number(set.r))).map(set => ({
        date: session.scheduled_date, sessionId: session.id, exerciseId: entry.id,
        exerciseName: target.name || entry.name || entry.id, weight: Number(set.w), reps: Number(set.r),
        unit: session.unit, source: 'assigned'
      }));
    });
  });
}

export function progressService(store, { readPersonalState = () => null, now = () => new Date() } = {}) {
  return {
    get(user, relationshipId, from = '0000-01-01', to = '9999-12-31', weeks = null) {
      const rel = store.db.prepare('SELECT * FROM client_relationships WHERE id=?').get(relationshipId);
      authorizeRelationship(user, rel, 'read');
      if (weeks !== null) {
        const count = Number(weeks);
        if (![4, 12, 24].includes(count)) throw new HttpError(422, 'VALIDATION_ERROR', 'Choose a 4, 12, or 24 week progress range');
        to = dateInZone(now(), rel.time_zone);
        from = addDays(to, 1 - count * 7);
      }
      const occurrences = store.db.prepare('SELECT * FROM workout_occurrences WHERE relationship_id=? AND scheduled_date BETWEEN ? AND ?').all(relationshipId, from, to);
      const attempts = store.db.prepare('SELECT * FROM assigned_sessions WHERE relationship_id=? AND scheduled_date BETWEEN ? AND ? ORDER BY started_at ASC, id ASC').all(relationshipId, from, to);
      const sessions = attempts.filter(session => session.state === 'finished');
      const attemptCounts = new Map();
      const reports = attempts.map(session => {
        const attempt = (attemptCounts.get(session.occurrence_id) || 0) + 1;
        attemptCounts.set(session.occurrence_id, attempt);
        return sessionReport(session, attempt);
      }).reverse();
      const personal = readPersonalState(rel.client_id) || {};
      const assignedIds = new Set(sessions.map(item => item.id));
      const personalWorkouts = (personal.workouts || []).filter(item => item.d >= from && item.d <= to && !assignedIds.has(item.id));
      const receipt = store.db.prepare('SELECT * FROM sync_receipts WHERE client_id=?').get(rel.client_id) || {};
      const strength = assignedStrength(sessions);
      const weight = (personal.bodyweight || []).filter(item => item.d >= from && item.d <= to).map(item => ({ date: item.d, value: item.w, unit: personal.unit || 'kg', source: 'personal' }));
      return {
        relationshipId, from, to, timeZone: rel.time_zone, sessions: reports,
        scheduled: occurrences.filter(item => item.state !== 'canceled').length,
        completed: completedOccurrenceCount(sessions),
        partial: sessions.filter(item => parsed(item.summary_json, {}).classification === 'partial').length,
        extra: sessions.filter(item => parsed(item.summary_json, {}).classification === 'extra').length,
        personalExtra: personalWorkouts.length,
        lastWorkout: [...sessions.map(item => item.client_finished_at), ...personalWorkouts.map(item => item.d)].filter(Boolean).sort().at(-1) || null,
        strength, weight,
        sync: { personalStateReceivedAt: receipt.personal_state_received_at || null, assignedResultReceivedAt: receipt.assigned_result_received_at || null },
        missing: { strength: strength.length === 0, weight: weight.length === 0 }
      };
    }
  };
}
