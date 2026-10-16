import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import WorkoutDetails, { canEditWorkout, workoutStatus, workoutTargetLabel } from './WorkoutDetails.jsx'

const today = '2026-10-01'
const occurrence = {
  id: 'workout-1', scheduledDate: today, state: 'scheduled',
  prescription: { dayName: 'Full Body', unit: 'lb', exercises: [
    { entryId: 'squat', name: 'Goblet Squat', mode: 'reps', restSec: 0, notes: 'Keep heels grounded\nStop if painful', sets: [{ reps: 8, weight: 20 }, { reps: 6, weight: 25 }] },
    { entryId: 'plank', name: 'Plank', mode: 'time', restSec: 30, sets: [{ seconds: 45, weight: 0 }] },
    { entryId: 'walk', name: 'Treadmill', mode: 'cardio', restSec: 60, sets: [{ minutes: 12.5, speed: 4.8 }] }
  ] }
}

describe('workout details', () => {
  it('shows ordered frozen exercises, different per-set targets, exact unit, zero rest and coach notes', () => {
    const html = renderToStaticMarkup(<WorkoutDetails occurrence={occurrence} today={today} timeZone="Asia/Kolkata" />)
    expect(html.indexOf('Goblet Squat')).toBeLessThan(html.indexOf('Plank'))
    expect(html.indexOf('Plank')).toBeLessThan(html.indexOf('Treadmill'))
    for (const text of ['8 reps · 20 lb', '6 reps · 25 lb', '45 sec · 0 lb', '12.5 min · 4.8 km/h', 'Rest: 0 sec', 'Keep heels grounded\nStop if painful', '2026-10-01', 'Asia/Kolkata']) expect(html).toContain(text)
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<textarea')
  })

  it('keeps edit separate and only offers it for upcoming unstarted workouts', () => {
    expect(canEditWorkout(occurrence, today)).toBe(true)
    expect(canEditWorkout({ ...occurrence, scheduledDate: '2026-10-02' }, today)).toBe(true)
    for (const row of [
      { ...occurrence, scheduledDate: '2026-09-30' },
      ...['started', 'completed', 'canceled'].map(state => ({ ...occurrence, state }))
    ]) {
      expect(canEditWorkout(row, today)).toBe(false)
      expect(renderToStaticMarkup(<WorkoutDetails occurrence={row} today={today} onEdit={() => {}} />)).not.toContain('>Edit this workout<')
    }
    expect(renderToStaticMarkup(<WorkoutDetails occurrence={occurrence} today={today} onEdit={() => {}} />)).toContain('>Edit this workout<')
  })

  it('preserves server result labels and distinguishes missed from pending sync and approved rest', () => {
    expect(workoutStatus({ ...occurrence, scheduledDate: '2026-09-30' }, today).label).toBe('Missed')
    expect(workoutStatus({ ...occurrence, state: 'started', scheduledDate: '2026-09-30' }, today).label).toBe('In progress')
    expect(workoutStatus({ ...occurrence, state: 'canceled', cancellationReason: 'explicit' }, today).label).toBe('Day off')
    expect(workoutStatus({ ...occurrence, state: 'completed', day: { label: 'Finished with no sets', state: 'zero' } }, today).label).toBe('Finished with no sets')
  })

  it('does not round prescribed targets or silently turn missing values into zero', () => {
    expect(workoutTargetLabel({ reps: 8, weight: 20.125 }, 'reps', 'kg')).toBe('8 reps · 20.125 kg')
    expect(workoutTargetLabel({ seconds: 30 }, 'time', 'kg')).toBe('30 sec')
  })
})
