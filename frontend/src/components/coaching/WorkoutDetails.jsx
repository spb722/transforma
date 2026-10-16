import { useEffect, useRef } from 'react'
import { Button, StatusBadge } from '../ui.jsx'
import { dateInZone } from '../../lib/coaching/dates.js'
import './workout-details.css'

const number = value => value == null || !Number.isFinite(Number(value)) ? 'Not specified' : String(Number(value))

export function workoutTargetLabel(set, mode, unit) {
  if (mode === 'cardio') return `${number(set.minutes)} min${set.speed == null ? '' : ` · ${number(set.speed)} km/h`}`
  if (mode === 'time') return `${number(set.seconds)} sec${set.weight == null ? '' : ` · ${number(set.weight)} ${unit}`}`
  return `${number(set.reps)} reps · ${number(set.weight)} ${unit}`
}

export function canEditWorkout(occurrence, today) {
  return occurrence?.state === 'scheduled' && occurrence.scheduledDate >= today
}

export function workoutStatus(occurrence, today, daySummary) {
  const day = daySummary || occurrence.day
  if (day?.label || occurrence.statusLabel) return { label: day?.label || occurrence.statusLabel, key: (day?.state || occurrence.displayState || occurrence.state).replaceAll('_', '-') }
  if (occurrence.state === 'canceled') return { label: occurrence.cancellationReason === 'explicit' ? 'Day off' : 'Removed by plan', key: 'day-off' }
  if (occurrence.state === 'started') return { label: 'In progress', key: 'in-progress' }
  if (occurrence.state === 'completed') return { label: 'Completed', key: 'completed' }
  if (occurrence.scheduledDate < today) return { label: 'Missed', key: 'missed' }
  return { label: 'Scheduled', key: 'scheduled' }
}

function timeLabel(value, timeZone) {
  if (!value || !Number.isFinite(Date.parse(value))) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(value))
}

export default function WorkoutDetails({ occurrence, timeZone = 'UTC', today = dateInZone(new Date(), timeZone), daySummary, onEdit, onClose }) {
  const heading = useRef(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    heading.current?.scrollIntoView({ block: 'nearest' })
  }, [occurrence?.id])
  if (!occurrence) return null
  const prescription = occurrence.prescription || {}
  const exercises = prescription.exercises || []
  const unit = prescription.unit || 'kg'
  const day = daySummary || occurrence.day
  const status = workoutStatus(occurrence, today, day)
  const started = timeLabel(day?.startedAt || occurrence.startedAt, timeZone)
  const finished = timeLabel(day?.finishedAt || occurrence.finishedAt, timeZone)

  return <section className="workout-details coaching-panel" aria-label="Workout details">
    <div className="workout-details-heading">
      <div><span className="coaching-kicker">Workout details</span><h2 ref={heading} tabIndex={-1}>{prescription.dayName || 'Workout'}</h2><p>{occurrence.scheduledDate} · {timeZone}</p></div>
      {onClose && <Button onClick={onClose}>Close details</Button>}
    </div>
    <div className="workout-details-meta"><StatusBadge status={status.key} label={status.label} /><span>{exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'} · {unit}</span>{occurrence.oneTime && <span>One-time workout</span>}{occurrence.customized && <span>Customized for this date</span>}</div>
    {occurrence.overrideDate && <p>Moved from {occurrence.originalDate}</p>}
    {(started || finished) && <dl className="workout-details-times">{started && <div><dt>Started</dt><dd>{started}</dd></div>}{finished && <div><dt>Finished</dt><dd>{finished}</dd></div>}</dl>}
    {day?.syncStatus === 'awaiting_result' && <p className="workout-details-notice">The start has reached the server. The client may still be training or waiting for their result to sync.</p>}
    <ol className="workout-details-exercises">{exercises.map((exercise, index) => <li key={exercise.entryId || `${exercise.exerciseId}-${index}`}>
      <h3><span aria-hidden="true">{index + 1}.</span> {exercise.name}</h3>
      <p className="workout-details-rest">{exercise.sets?.length || 0} sets · Rest: {number(exercise.restSec)} sec</p>
      <ol className="workout-details-sets" aria-label={`${exercise.name} targets`}>{(exercise.sets || []).map((set, setIndex) => <li key={setIndex}><span>Set {setIndex + 1}</span><strong>{workoutTargetLabel(set, exercise.mode, unit)}</strong></li>)}</ol>
      {exercise.notes && <p className="workout-details-notes"><strong>Coach notes</strong>{exercise.notes}</p>}
    </li>)}</ol>
    {!exercises.length && <p>No exercises were recorded for this workout.</p>}
    {onEdit && canEditWorkout(occurrence, today) && <div className="coaching-actions"><Button onClick={() => onEdit(occurrence)}>Edit this workout</Button><span>Changes apply to this date only.</span></div>}
    {onEdit && !canEditWorkout(occurrence, today) && <p className="workout-details-notice">Only upcoming, unstarted workouts can be edited.</p>}
  </section>
}
