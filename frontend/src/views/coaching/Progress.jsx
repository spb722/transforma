import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import { coachingApi } from '../../lib/coaching/api.js'
import { Button, Skeleton } from '../../components/ui.jsx'
import { useStore } from '../../store/useStore.js'
import SessionReport from '../../components/coaching/SessionReport.jsx'

export default function Progress({ mode }) {
  const { relationshipId } = useParams()
  const nav = useNavigate()
  const [weeks, setWeeks] = useState(12)
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState(null)
  const [failure, setFailure] = useState(null)
  const accountId = useStore(state => state.user?.id)
  const requestKey = `${accountId || ''}:${relationshipId}:${weeks}`
  const data = result?.key === requestKey ? result.data : null
  const error = failure?.key === requestKey ? failure.message : ''

  useEffect(() => {
    const controller = new AbortController()
    let current = true
    setResult(null)
    setFailure(null)
    if (!accountId) return () => { current = false; controller.abort() }
    coachingApi(`/progress?relationshipId=${encodeURIComponent(relationshipId)}&weeks=${weeks}`, { signal: controller.signal })
      .then(value => { if (current) setResult({ key: requestKey, data: value }) })
      .catch(error => {
        if (current && error.name !== 'AbortError') {
          setResult(null)
          setFailure({ key: requestKey, message: error.message })
        }
      })
    return () => { current = false; controller.abort() }
  }, [accountId, relationshipId, weeks, requestKey, retry])

  return <CoachingShell mode={mode} title="Progress" eyebrow={`Last ${weeks} weeks`} action={<div className="coaching-actions">
    <select aria-label="Progress range" value={weeks} onChange={event => setWeeks(Number(event.target.value))}>
      <option value="4">4 weeks</option><option value="12">12 weeks</option><option value="24">24 weeks</option>
    </select>
    <Button onClick={() => setRetry(value => value + 1)}>Refresh</Button>
    <Button onClick={() => nav(mode === 'trainer' ? `/studio/clients/${relationshipId}` : `/coaching/${relationshipId}`)}>Back</Button>
  </div>}>
    {error && <div className="coaching-error" role="alert"><p>{error}</p><div className="coaching-actions"><Button onClick={() => setRetry(value => value + 1)}>Try again</Button></div></div>}
    {!data ? !error && <section className="coaching-panel" role="status" aria-label="Loading progress" style={{ display: 'grid', gap: 10 }}>
      <Skeleton style={{ height: 14, width: '30%' }} /><Skeleton style={{ height: 20, width: '55%' }} /><Skeleton style={{ height: 12, width: '75%' }} />
    </section> : <>
      <div className="coaching-stat-grid">
        <article><span>Days with logged sets</span><strong>{data.completed}/{data.scheduled}</strong></article>
        <article><span>Partial sessions</span><strong>{data.partial}</strong></article>
        <article><span>Extra workouts</span><strong>{data.extra + data.personalExtra}</strong></article>
      </div>
      <section className="coaching-panel">
        <h2>Workout results</h2>
        <p>Open an attempt to compare the original targets with every logged set. Repeated attempts count toward the scheduled day only once.</p>
        <div className="session-report-list">{data.sessions?.length ? data.sessions.map(session => <SessionReport key={session.sessionId} session={session} mode={mode} />) : <p>No assigned workout attempts in this date range.</p>}</div>
      </section>
      <section className="coaching-panel">
        <h2>Latest activity</h2><p>{data.lastWorkout || 'No workout data yet.'}</p>
        <h2 className="coaching-subhead">Strength</h2>
        {data.strength.length ? <div className="coaching-weight-list">{data.strength.slice(-8).map((item, index) => <span key={`${item.sessionId}-${item.exerciseId}-${index}`}>{item.date}<strong>{item.exerciseName}: {item.weight} {item.unit} × {item.reps}</strong><small>{item.source}</small></span>)}</div> : <p>Strength data is missing.</p>}
        <h2 className="coaching-subhead">Weight</h2>
        {data.weight.length ? <div className="coaching-weight-list">{data.weight.slice(-8).map(item => <span key={item.date}>{item.date}<strong>{item.value} {item.unit}</strong><small>{item.source}</small></span>)}</div> : <p>Weight data is missing.</p>}
      </section>
      <section className="coaching-panel"><h2>Server sync</h2><p>Personal history: {data.sync.personalStateReceivedAt || 'not received yet'}</p><p>Assigned results: {data.sync.assignedResultReceivedAt || 'not received yet'}</p></section>
    </>}
  </CoachingShell>
}
