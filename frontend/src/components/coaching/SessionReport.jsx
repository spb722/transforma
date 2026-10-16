import { useState } from 'react'
import SessionFeedback from './SessionFeedback.jsx'
import './session-report.css'

const labels = { in_progress: 'In progress', abandoned: 'Abandoned', zero: 'Finished with no sets', partial: 'Partial', completed: 'Completed' }
const value = number => Number.isFinite(Number(number)) && number != null ? Number(Number(number).toFixed(2)) : '—'

export function reportSetLabel(set, mode, unit, actual = false) {
  if (!set) return '—'
  if (mode === 'time') return `${value(actual ? set.sec : set.seconds)} sec${(actual ? set.w : set.weight) ? ` · ${value(actual ? set.w : set.weight)} ${unit}` : ''}`
  if (mode === 'cardio') return `${value(actual ? set.min : set.minutes)} min · ${value(set.speed)} km/h`
  return `${value(actual ? set.w : set.weight)} ${unit} × ${value(actual ? set.r : set.reps)} reps${actual && set.rir != null ? ` · ${value(set.rir)} RIR` : ''}`
}

export function reportTime(timestamp, timeZone) {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: timeZone || 'UTC' }).format(new Date(timestamp))
}

export default function SessionReport({ session, mode = 'client' }) {
  const [expanded, setExpanded] = useState(false)
  return <details className="session-report" id={`session-${session.sessionId}`} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>
      <span><strong>{session.workoutName}</strong><small>{session.scheduledDate} · Attempt {session.attempt}</small></span>
      <span className="session-report-summary"><strong>{labels[session.classification] || session.classification}</strong><small>{session.completedSets}/{session.targetSets} sets{session.extra ? ' · Repeat attempt' : ''}{session.feedback?.needsAttention ? ' · Feedback needs review' : ''}</small></span>
      <span className="session-report-expand" aria-hidden="true">⌄</span>
    </summary>
    <div className="session-report-content">
      <dl className="session-report-meta">
        <div><dt>Started</dt><dd>{reportTime(session.startedAt, session.timeZone)}</dd></div>
        <div><dt>Finished</dt><dd>{session.clientFinishedAt ? reportTime(session.clientFinishedAt, session.timeZone) : 'Not received yet'}</dd></div>
        {session.durationSeconds != null && <div><dt>Duration</dt><dd>{Math.floor(session.durationSeconds / 60)} min {session.durationSeconds % 60} sec</dd></div>}
        <div><dt>Time zone</dt><dd>{session.timeZone || 'UTC'}</dd></div>
        <div><dt>Server sync</dt><dd>{session.syncStatus === 'received' ? `Received ${reportTime(session.receivedAt, session.timeZone)}` : 'Start received · waiting for result'}</dd></div>
      </dl>
      {session.state === 'started' && <p className="session-report-notice">The result has not reached the server. The client may still be training or waiting to sync. Sets are shown after the result arrives.</p>}
      {session.skippedSets > 0 && <p className="session-report-notice">{session.skippedSets} prescribed {session.skippedSets === 1 ? 'set was' : 'sets were'} not completed.</p>}
      {(session.exercises || []).map((exercise, index) => <section key={`${exercise.entryId}-${index}`} className="session-report-exercise">
        <h3>{index + 1}. {exercise.name}{exercise.additional && <small>Additional exercise</small>}</h3>
        {(exercise.restSec != null || exercise.notes) && <p>{exercise.restSec != null ? `Rest: ${exercise.restSec} sec` : ''}{exercise.notes ? `${exercise.restSec != null ? ' · ' : ''}${exercise.notes}` : ''}</p>}
        <table><caption className="sr-only">{exercise.name}: prescribed and actual sets</caption><thead><tr><th scope="col">Set</th><th scope="col">Prescribed</th><th scope="col">Actual</th></tr></thead><tbody>
          {exercise.sets.map(set => <tr key={set.number}><th scope="row">{set.number}</th><td>{set.prescribed ? reportSetLabel(set.prescribed, exercise.mode, session.unit) : 'Additional set'}</td><td className={set.status === 'skipped' ? 'session-report-skipped' : ''}>{set.actual ? reportSetLabel(set.actual, exercise.mode, session.actualUnit, true) : set.status === 'pending' ? 'Awaiting result' : 'Skipped'}</td></tr>)}
        </tbody></table>
      </section>)}
      {expanded && session.state !== 'started' && <SessionFeedback sessionId={session.sessionId} initialFeedback={session.feedback} mode={mode} />}
      {!session.exercises?.length && <p>No exercise prescription was recorded for this attempt.</p>}
    </div>
  </details>
}
