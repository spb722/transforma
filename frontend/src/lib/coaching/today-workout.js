import { dateInZone } from './dates.js'
import { occurrenceOnDate } from './schedule.js'

const labels = { scheduled: 'Scheduled', started: 'In progress', in_progress: 'In progress', completed: 'Completed', day_off: 'Day off', no_workout: 'No workout', partial: 'Partial', zero: 'Finished with no sets', abandoned: 'Abandoned', missed: 'Missed' }

export function todayWorkout(workspace, now = new Date()) {
  const timeZone = workspace.relationship.timeZone || 'UTC'
  const date = dateInZone(now, timeZone)
  const occurrence = occurrenceOnDate(workspace, date)
  // A cached server summary can belong to yesterday after local midnight.
  const server = workspace.today?.date === date ? workspace.today : occurrence?.day
  if (server?.date === date) return { ...server, occurrence, timeZone }
  const state = occurrence?.state === 'canceled' ? 'day_off' : occurrence?.state || 'no_workout'
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7
  const reason = occurrence ? occurrence.cancellationReason : !workspace.workout ? 'no_plan' : !(workspace.workout.content?.days || []).some(day => day.weekdays?.includes(weekday)) ? 'planned_rest_day' : 'no_scheduled_workout'
  return { date, timeZone, occurrence, state, label: labels[state], reason, workoutName: occurrence?.prescription?.dayName, exerciseCount: occurrence?.prescription?.exercises?.length || 0, startedAt: occurrence?.startedAt, finishedAt: occurrence?.finishedAt, receivedAt: occurrence?.receivedAt }
}

export function emptyWorkoutReason(reason, mode) {
  if (reason === 'planned_rest_day') return 'This is a planned rest day in the recurring schedule.'
  if (reason === 'no_plan') return mode === 'trainer' ? 'No recurring workout plan has been assigned. Assign a plan or add a workout for one date.' : 'Your trainer has not assigned a recurring workout plan yet.'
  if (reason === 'explicit') return 'Your trainer has marked this date as a day off.'
  return 'No workout is scheduled for this date.'
}
