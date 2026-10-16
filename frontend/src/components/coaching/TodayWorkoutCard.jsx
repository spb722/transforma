import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore.js'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import { todayWorkout, emptyWorkoutReason } from '../../lib/coaching/today-workout.js'
import { assignedOutbox } from '../../lib/coaching/outbox.js'
import { beginAssignedWorkout } from '../../sheets.jsx'
import { Button } from '../ui.jsx'
import WorkoutDetails from './WorkoutDetails.jsx'
import './today-workout.css'

function clockTime(value, timeZone) {
  if (!value) return null
  return new Date(value).toLocaleString(undefined, { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function TodayWorkoutCard({ workspace, mode = 'client', onAssign, onManage, onProgress }) {
  const nav = useNavigate()
  const accountId = useCoachingStore(state => state.userId)
  const personal = useStore(state => state.S)
  const [details, setDetails] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; const timer = setInterval(() => setNow(new Date()), 30000); return () => { mounted.current = false; clearInterval(timer) } }, [])
  useEffect(() => { setDetails(false); setError(''); setBusy(false) }, [accountId, workspace.relationship.id])
  const day = todayWorkout(workspace, now)
  const occurrence = day.occurrence
  const active = workspace.relationship.status === 'active'
  const queued = mode === 'client' && accountId ? assignedOutbox.pending(accountId).find(item => item.sessionId === day.sessionId) : null
  const localFinished = mode === 'client' ? personal.workouts?.find(item => item.occurrenceId === occurrence?.id && item.relationshipId === workspace.relationship.id) : null
  const waiting = Boolean(queued || (localFinished && !day.receivedAt && !day.finishedAt))
  const state = waiting ? 'waiting' : day.state
  const label = waiting ? 'Waiting to sync' : day.label
  const canStart = active && !waiting && occurrence && ['scheduled', 'started'].includes(occurrence.state)
  const start = async () => {
    if (busy) return
    if (personal.active) { nav('/workout'); return }
    setBusy(true); setError('')
    try { await beginAssignedWorkout(occurrence) }
    catch (failure) { if (mounted.current && useCoachingStore.getState().userId === accountId) setError(failure.message || 'Could not start this workout. Try again.') }
    finally { if (mounted.current && useCoachingStore.getState().userId === accountId) setBusy(false) }
  }
  const workoutDate = new Date(`${day.date}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
  const finishedAt = queued?.clientFinishedAt || (localFinished?.end ? new Date(localFinished.end).toISOString() : day.finishedAt)
  return <>
    <section className="coaching-panel today-workout" aria-label="Today's workout">
      <div className="today-workout-heading"><div><p className="today-workout-eyebrow">Today's workout</p><p className="today-workout-date"><time dateTime={day.date}>{workoutDate}</time> · {day.timeZone}</p></div><span className={`today-workout-status today-workout-status-${state}`}>{label}</span></div>
      <h2>{occurrence ? <button className="today-workout-name" onClick={() => setDetails(value => !value)} aria-expanded={details}>{day.workoutName || occurrence.prescription?.dayName || 'Workout'}</button> : 'No workout today'}</h2>
      {occurrence && <p>{day.exerciseCount} {day.exerciseCount === 1 ? 'exercise' : 'exercises'}{occurrence.oneTime ? ' · One-time workout' : ''}{occurrence.customized ? ' · Customized for this date' : ''}</p>}
      {(!occurrence || state === 'day_off') && <p>{emptyWorkoutReason(day.reason, mode)}</p>}
      {(day.startedAt || finishedAt) && <div className="today-workout-times">{day.startedAt && <span>Started <strong>{clockTime(day.startedAt, day.timeZone)}</strong></span>}{finishedAt && <span>Finished <strong>{clockTime(finishedAt, day.timeZone)}</strong></span>}</div>}
      {waiting ? <p role="status">Your result is saved on this device and waiting to reach your trainer. Reconnect to sync.</p> : day.syncStatus === 'awaiting_result' ? <p>{mode === 'trainer' ? 'The session has started. A finished result has not reached the server yet.' : 'Your session is in progress. Finish it to send the result to your trainer.'}</p> : day.receivedAt ? <p>Result received{mode === 'client' ? ' by your trainer' : ''}.</p> : null}
      <div className="coaching-actions today-workout-actions">
        {mode === 'client' && canStart && <Button variant="primary" disabled={busy} onClick={start}>{busy ? 'Opening workout…' : personal.active ? 'Continue current workout' : occurrence.state === 'started' ? 'Resume workout' : 'Start workout'}</Button>}
        {occurrence && <Button onClick={() => setDetails(value => !value)} aria-expanded={details}>{details ? 'Hide workout details' : 'View workout details'}</Button>}
        {mode === 'trainer' && active && occurrence && ['scheduled', 'canceled'].includes(occurrence.state) && onManage && <Button onClick={() => onManage(occurrence)}>Manage this workout</Button>}
        {mode === 'trainer' && active && onAssign && (!occurrence || occurrence.state === 'canceled') && <Button variant="primary" onClick={() => onAssign(day.date)}>Assign workout for a date</Button>}
        {(day.sessionId || localFinished) && onProgress && <Button onClick={onProgress}>View results</Button>}
      </div>
      {error && <p className="coaching-error" role="alert">{error}</p>}
    </section>
    {details && occurrence && <WorkoutDetails occurrence={occurrence} timeZone={day.timeZone} today={day.date} daySummary={day} onClose={() => setDetails(false)} onEdit={mode === 'trainer' && active && onManage ? () => onManage(occurrence, true) : undefined} />}
  </>
}
