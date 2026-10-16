import { dateInZone, isoWeekday } from './dates.js';

const labels = {
  scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed',
  day_off: 'Day off', missed: 'Missed', no_workout: 'No workout',
  partial: 'Partial', zero: 'Finished with no sets', abandoned: 'Abandoned'
};
const parse = value => value ? JSON.parse(value) : null;

// Derive display state without changing the occurrence or its frozen result.
export function occurrenceDaySummary(row, sessions, today, timeZone) {
  const active = sessions.find(session => session.state === 'started');
  const latest = active || sessions[0];
  const prescription = parse(latest?.prescription_json || row.prescription_override_json || row.prescription_json) || {};
  const result = parse(latest?.summary_json);
  let state = row.state === 'canceled' ? (row.cancellation_reason === 'explicit' ? 'day_off' : 'no_workout')
    : active || row.state === 'started' ? 'in_progress'
      : row.state === 'completed' ? 'completed' : 'scheduled';
  if (latest?.state === 'abandoned' && !active) state = 'abandoned';
  if (latest?.state === 'finished' && !active) state = ['partial', 'zero'].includes(result?.classification) ? result.classification : 'completed';
  if (row.state === 'scheduled' && !sessions.length && row.scheduled_date < today) state = 'missed';
  return {
    date: row.scheduled_date, timeZone, state, label: labels[state], reason: row.cancellation_reason || null,
    occurrenceId: row.id, workoutName: prescription.dayName || prescription.planName || 'Workout',
    exerciseCount: (prescription.exercises || []).length,
    startedAt: latest?.started_at || null, finishedAt: latest?.client_finished_at || null,
    receivedAt: latest?.received_at || null, sessionId: latest?.id || null,
    completionType: result?.classification || null,
    // The server cannot know whether a client has a finished result waiting offline.
    syncStatus: latest?.state === 'started' ? 'awaiting_result' : latest?.received_at ? 'received' : null
  };
}

export function relationshipDaySummary(store, relationship, instant) {
  const date = dateInZone(instant, relationship.time_zone);
  const assignment = store.db.prepare("SELECT a.current_revision_id,r.content_json FROM plan_assignments a LEFT JOIN plan_revisions r ON r.id=a.current_revision_id WHERE a.relationship_id=? AND a.kind='workout'").get(relationship.id);
  const occurrences = store.db.prepare('SELECT * FROM workout_occurrences WHERE relationship_id=? ORDER BY scheduled_date DESC,created_at DESC,id').all(relationship.id);
  const sessions = store.db.prepare('SELECT * FROM assigned_sessions WHERE relationship_id=? ORDER BY started_at DESC,id DESC').all(relationship.id);
  const byOccurrence = new Map();
  for (const session of sessions) {
    const attempts = byOccurrence.get(session.occurrence_id) || [];
    attempts.push(session);
    byOccurrence.set(session.occurrence_id, attempts);
  }
  const days = occurrences.map(row => occurrenceDaySummary(row, byOccurrence.get(row.id) || [], date, relationship.time_zone));
  const todayDays = days.filter(day => day.date === date);
  const today = todayDays.find(day => !['day_off', 'no_workout'].includes(day.state)) || todayDays.find(day => day.state === 'day_off');
  const hasPlan = !!assignment?.current_revision_id;
  const content = parse(assignment?.content_json);
  const plannedRest = hasPlan && !(content?.days || []).some(day => day.weekdays?.includes(isoWeekday(date)));
  return {
    today: today || {
      date, timeZone: relationship.time_zone, state: 'no_workout', label: labels.no_workout,
      reason: !hasPlan ? 'no_plan' : plannedRest ? 'planned_rest_day' : 'no_scheduled_workout',
      occurrenceId: null, workoutName: null, exerciseCount: 0,
      startedAt: null, finishedAt: null, receivedAt: null, sessionId: null, completionType: null, syncStatus: null
    },
    missedWorkouts: days.filter(day => day.state === 'missed'),
    days
  };
}
