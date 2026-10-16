import { describe, expect, it } from 'vitest'
import { todayWorkout, emptyWorkoutReason } from './today-workout.js'

const now = new Date('2026-10-01T12:30:00Z')
const workspace = { relationship: { id: 'r1', status: 'active', timeZone: 'Pacific/Kiritimati' }, workout: null, occurrences: [] }

describe('today workout summary', () => {
  it('uses the client timezone and does not reuse yesterday’s cached summary', () => {
    const day = todayWorkout({ ...workspace, today: { date: '2026-10-01', state: 'completed', workoutName: 'Yesterday' } }, now)
    expect(day.date).toBe('2026-10-02')
    expect(day.state).toBe('no_workout')
    expect(day.reason).toBe('no_plan')
  })
  it('distinguishes planned rest from a missing scheduled date', () => {
    expect(todayWorkout({ ...workspace, workout: { content: { days: [{ weekdays: [1] }] } } }, now).reason).toBe('planned_rest_day')
    expect(todayWorkout({ ...workspace, workout: { content: { days: [{ weekdays: [5] }] } } }, now).reason).toBe('no_scheduled_workout')
    expect(emptyWorkoutReason('planned_rest_day', 'client')).toContain('planned rest day')
  })
  it('keeps exact server result state, timing, and one-time occurrence without a recurring plan', () => {
    const occurrence = { id: 'one', scheduledDate: '2026-10-02', state: 'completed', oneTime: true, prescription: { dayName: 'Mobility', exercises: [{}] } }
    const today = { date: '2026-10-02', state: 'zero', label: 'Finished with no sets', occurrenceId: 'one', workoutName: 'Mobility', exerciseCount: 1, startedAt: '2026-10-01T12:10:00Z', finishedAt: '2026-10-01T12:20:00Z' }
    const day = todayWorkout({ ...workspace, today, occurrences: [occurrence] }, now)
    expect(day.state).toBe('zero')
    expect(day.startedAt).toBe(today.startedAt)
    expect(day.finishedAt).toBe(today.finishedAt)
    expect(day.occurrence).toBe(occurrence)
  })
  it('uses an explicit day off when no active workout occupies the date', () => {
    const day = todayWorkout({ ...workspace, occurrences: [{ id: 'off', scheduledDate: '2026-10-02', state: 'canceled', cancellationReason: 'explicit', prescription: { dayName: 'Rest', exercises: [] } }] }, now)
    expect(day.state).toBe('day_off')
    expect(emptyWorkoutReason(day.reason, 'trainer')).toContain('day off')
  })
})
