import { authorizeRelationship } from './access.js';

const parsed = (value, fallback) => { try { return JSON.parse(value || '') } catch { return fallback } };

function assignedStrength(sessions) {
  return sessions.flatMap(session => {
    const prescription = parsed(session.prescription_json, {});
    const actual = parsed(session.actual_json, {});
    const targets = new Map((prescription.exercises || []).map(exercise => [exercise.id, exercise]));
    return (actual.entries || []).flatMap(entry => {
      const target = targets.get(entry.id) || {};
      if (target.mode && target.mode !== 'reps') return [];
      return (entry.sets || []).filter(set => set.done && Number.isFinite(Number(set.w)) && Number.isFinite(Number(set.r))).map(set => ({
        date: session.scheduled_date, sessionId: session.id, exerciseId: entry.id,
        exerciseName: target.name || entry.name || entry.id, weight: Number(set.w), reps: Number(set.r),
        unit: session.unit, source: 'assigned'
      }));
    });
  });
}

export function progressService(store, { readPersonalState = () => null } = {}) {
  return {
    get(user, relationshipId, from = '0000-01-01', to = '9999-12-31') {
      const rel = store.db.prepare('SELECT * FROM client_relationships WHERE id=?').get(relationshipId);
      authorizeRelationship(user, rel, 'read');
      const occurrences = store.db.prepare('SELECT * FROM workout_occurrences WHERE relationship_id=? AND scheduled_date BETWEEN ? AND ?').all(relationshipId, from, to);
      const sessions = store.db.prepare("SELECT * FROM assigned_sessions WHERE relationship_id=? AND scheduled_date BETWEEN ? AND ? AND state='finished'").all(relationshipId, from, to);
      const personal = readPersonalState(rel.client_id) || {};
      const assignedIds = new Set(sessions.map(item => item.id));
      const personalWorkouts = (personal.workouts || []).filter(item => item.d >= from && item.d <= to && !assignedIds.has(item.id));
      const receipt = store.db.prepare('SELECT * FROM sync_receipts WHERE client_id=?').get(rel.client_id) || {};
      const strength = assignedStrength(sessions);
      const weight = (personal.bodyweight || []).filter(item => item.d >= from && item.d <= to).map(item => ({ date: item.d, value: item.w, unit: personal.unit || 'kg', source: 'personal' }));
      return {
        relationshipId, from, to,
        scheduled: occurrences.filter(item => item.state !== 'canceled').length,
        completed: new Set(sessions.map(item => item.occurrence_id)).size,
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
