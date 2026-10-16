import { sessionFeedback } from './session-feedback.js';
const parsed = (value, fallback) => { try { return JSON.parse(value || '') ?? fallback; } catch { return fallback; } };

export function sessionReport(row, attempt = 1) {
  const prescription = parsed(row.prescription_json, {});
  const actual = parsed(row.actual_json, {});
  const summary = parsed(row.summary_json, {});
  const entries = Array.isArray(actual.entries) ? actual.entries : [];
  const used = new Set();
  const terminal = row.state !== 'started';
  const exercises = (prescription.exercises || []).map((exercise, index) => {
    const entryIndex = entries.findIndex((entry, candidate) => !used.has(candidate) && (
      exercise.entryId && entry.entryId ? exercise.entryId === entry.entryId :
        (exercise.exerciseId || exercise.id) === (entry.id || entry.exerciseId)
    ));
    if (entryIndex >= 0) used.add(entryIndex);
    const entry = entries[entryIndex];
    const prescribedSets = exercise.sets || [];
    const actualSets = entry?.sets || [];
    return {
      entryId: exercise.entryId || `${exercise.id || exercise.exerciseId}-${index}`,
      exerciseId: exercise.exerciseId || exercise.id, name: exercise.name || entry?.name || 'Exercise',
      mode: exercise.mode || 'reps', restSec: exercise.restSec ?? null, notes: exercise.notes || '',
      sets: Array.from({ length: Math.max(prescribedSets.length, actualSets.length) }, (_, setIndex) => ({
        number: setIndex + 1, prescribed: prescribedSets[setIndex] || null,
        actual: actualSets[setIndex]?.done ? actualSets[setIndex] : null,
        status: actualSets[setIndex]?.done ? 'done' : terminal ? 'skipped' : 'pending'
      }))
    };
  });
  for (const [index, entry] of entries.entries()) {
    if (used.has(index)) continue;
    exercises.push({ entryId: entry.entryId || `extra-${index}`, exerciseId: entry.id,
      name: entry.name || entry.id || 'Additional exercise', mode: entry.target?.mode || entry.mode || 'reps',
      restSec: null, notes: '', additional: true,
      sets: (entry.sets || []).map((set, setIndex) => ({ number: setIndex + 1, prescribed: null,
        actual: set.done ? set : null, status: set.done ? 'done' : terminal ? 'skipped' : 'pending' }))
    });
  }
  const targetSets = exercises.reduce((n, exercise) => n + exercise.sets.filter(set => set.prescribed).length, 0);
  const completedSets = exercises.reduce((n, exercise) => n + exercise.sets.filter(set => set.actual).length, 0);
  const skippedSets = terminal ? exercises.reduce((n, exercise) => n + exercise.sets.filter(set => set.prescribed && !set.actual).length, 0) : 0;
  const elapsed = Date.parse(row.client_finished_at) - Date.parse(row.started_at);
  return {
    feedback: sessionFeedback(row), sessionId: row.id, occurrenceId: row.occurrence_id, scheduledDate: row.scheduled_date,
    workoutName: prescription.dayName || prescription.name || 'Assigned workout',
    state: row.state, attempt, startedAt: row.started_at, clientFinishedAt: row.client_finished_at || null,
    receivedAt: row.received_at || null, timeZone: row.time_zone, unit: row.unit || prescription.unit || 'kg',
    actualUnit: actual.unit || row.unit || prescription.unit || 'kg',
    durationSeconds: Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed / 1000) : null,
    classification: row.state === 'started' ? 'in_progress' : row.state === 'abandoned' ? 'abandoned' :
      completedSets === 0 ? 'zero' : skippedSets > 0 ? 'partial' : 'completed',
    extra: summary.classification === 'extra', targetSets, completedSets, skippedSets, exercises,
    syncStatus: row.received_at ? 'received' : 'awaiting_result'
  };
}
