import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import CheckInResponse from '../../components/coaching/CheckInResponse.jsx'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import { coachingApi, coachingMutation } from '../../lib/coaching/api.js'
import { Button } from '../../components/ui.jsx'
import { mondayInZone } from '../../lib/coaching/dates.js'

const freshForm = () => ({ adherence: 'mostly', weightValue: '', weightUnit: 'kg', notes: '' })
const endOfWeek = monday => {
  const day = new Date(`${monday}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + 6)
  return day.toISOString().slice(0, 10)
}

function Response({ response }) {
  return <div className="coaching-response"><strong>Trainer response</strong><p>{response.text}</p><small>{new Date(response.updatedAt).toLocaleString()}</small></div>
}

function Report({ report }) {
  return <div className="coaching-report"><h3>Week of {report.weekStart}</h3><strong>{report.adherence}</strong><p>{report.notes || 'No notes supplied.'}</p>{report.weightValue != null && <span>{report.weightValue} {report.weightUnit}</span>}{report.response && <Response response={report.response} />}</div>
}

export default function WeeklyCheckIn({ mode }) {
  const { relationshipId } = useParams()
  const userId = useCoachingStore(s => s.userId)
  return <CheckInView key={`${userId}:${relationshipId}:${mode}`} mode={mode} />
}

function CheckInView({ mode }) {
  const { relationshipId } = useParams(), nav = useNavigate(), store = useCoachingStore()
  const loaded = mode === 'trainer' ? store.trainerWorkspace : store.ownViewedWorkspace
  const workspace = loaded?.relationship?.id === relationshipId ? loaded : null
  const load = mode === 'trainer' ? store.loadTrainerWorkspace : store.loadOwnWorkspace
  const [form, setForm] = useState(freshForm), [status, setStatus] = useState(''), [fields, setFields] = useState({})
  const [reports, setReports] = useState([]), [historyError, setHistoryError] = useState('')
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState('')
  const active = useRef(false), loadSequence = useRef(0)
  const userId = store.userId
  const loadWorkspace = useCallback(async () => {
    if (!active.current || useCoachingStore.getState().userId !== userId) return null
    const request = ++loadSequence.current
    const currentRequest = () => active.current && request === loadSequence.current && useCoachingStore.getState().userId === userId
    setLoading(true); setLoadError('')
    try {
      const result = await load(relationshipId)
      if (!currentRequest()) return null
      if (!result) throw new Error('Could not load the check-in. Try again.')
      return result
    } catch (error) {
      if (currentRequest()) setLoadError(error.message)
      throw error
    } finally { if (currentRequest()) setLoading(false) }
  }, [load, relationshipId, userId])
  const weekStart = mondayInZone(new Date(), workspace?.relationship?.timeZone || 'UTC')
  // A previous week's version cannot create this week's distinct report.
  const current = workspace?.checkIn?.weekStart === weekStart ? workspace.checkIn : null
  const report = mode === 'trainer' ? workspace?.checkIn : current
  const archived = workspace?.relationship?.status === 'ended'
  useEffect(() => {
    active.current = true
    loadWorkspace().catch(() => {})
    return () => { active.current = false; loadSequence.current += 1 }
  }, [loadWorkspace])
  useEffect(() => {
    const c = current
    setForm(c ? { adherence: c.adherence, weightValue: c.weightValue ?? '', weightUnit: c.weightUnit || 'kg', notes: c.notes || '' } : freshForm())
  }, [current?.id, current?.version])
  useEffect(() => {
    if (mode === 'trainer' || !workspace) return
    const controller = new AbortController()
    coachingApi(`/check-ins?relationshipId=${encodeURIComponent(relationshipId)}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setReports(Array.isArray(data) ? data : data?.items || []); setHistoryError('') } })
      .catch(error => { if (!controller.signal.aborted) { setReports([]); setHistoryError(error.message) } })
    return () => controller.abort()
  }, [mode, relationshipId, workspace?.relationship?.id, workspace?.checkIn?.id, workspace?.checkIn?.version])
  const save = async () => {
    if (!workspace || archived) return
    setStatus('Saving…'); setFields({})
    try {
      await coachingMutation('/check-ins', { relationshipId, weekStart, expectedVersion: current?.version || 0, ...form, weightValue: form.weightValue === '' ? null : +form.weightValue }, { method: 'PUT' })
      if (!active.current || useCoachingStore.getState().userId !== userId) return
      await loadWorkspace()
      if (active.current && useCoachingStore.getState().userId === userId) setStatus('Saved')
    } catch (error) {
      if (!active.current || useCoachingStore.getState().userId !== userId) return
      setFields(error.fields || {})
      const details = Object.entries(error.fields || {}).map(([field, message]) => `${field} ${message}`).join('; ')
      setStatus(details ? `${error.message}: ${details}` : error.message)
    }
  }
  const history = archived ? reports : reports.filter(item => item.weekStart !== weekStart)
  return <CoachingShell mode={mode} title="Weekly check-in" eyebrow={workspace?.client?.name || 'Coaching'} action={<Button onClick={() => nav(mode === 'trainer' ? `/studio/clients/${relationshipId}` : `/coaching/${relationshipId}`)}>Back</Button>}>
    <section className="coaching-panel">
      {loadError && <div className="coaching-error" role="alert"><p>{loadError}</p><div className="coaching-actions"><Button disabled={loading} onClick={() => loadWorkspace().catch(() => {})}>Try again</Button></div></div>}
      {!workspace ? loading && <p role="status">Loading check-in…</p> : mode === 'trainer' ? <>
        <h2>Client report</h2>{report ? <><h3>Week of {report.weekStart}</h3><div className="coaching-report"><strong>{report.adherence}</strong><p>{report.notes || 'No notes supplied.'}</p>{report.weightValue != null && <span>{report.weightValue} {report.weightUnit}</span>}</div></> : <p>No report this week.</p>}
        <CheckInResponse checkIn={report} onSaved={() => loadWorkspace().catch(() => {})} />
      </> : archived ? <p className="coaching-muted">Archived check-in, read-only.</p> : <div className="coaching-form">
        <h2>How did the week go?</h2><p>Week {weekStart} to {endOfWeek(weekStart)} · {workspace.relationship.timeZone}</p>
        <div className="coaching-adherence">{[['all', 'All'], ['mostly', 'Mostly'], ['some', 'Some'], ['none', 'None']].map(([value, label]) => <button type="button" key={value} aria-pressed={form.adherence === value} className={form.adherence === value ? 'on' : ''} onClick={() => setForm({ ...form, adherence: value })}>{label}</button>)}</div>
        <label><span>Weight, optional</span><div className="coaching-inline"><input type="number" min="1" step="0.1" value={form.weightValue} aria-invalid={!!fields.weightValue} onChange={event => setForm({ ...form, weightValue: event.target.value })} /><select aria-label="Weight unit" value={form.weightUnit} onChange={event => setForm({ ...form, weightUnit: event.target.value })}><option>kg</option><option>lb</option></select></div></label>
        <label><span>Notes, optional</span><textarea rows="5" value={form.notes} aria-invalid={!!fields.notes} aria-describedby={fields.notes ? 'checkin-notes-error' : undefined} onChange={event => setForm({ ...form, notes: event.target.value })} />{fields.notes && <small id="checkin-notes-error" className="coaching-error">Notes {fields.notes}</small>}</label>
        <div className="coaching-actions"><Button variant="primary" onClick={save}>Save check-in</Button><span role="status">{status}</span></div>
        {current?.response && <Response response={current.response} />}
      </div>}
    </section>
    {workspace && mode !== 'trainer' && <section className="coaching-panel coaching-checkin-history"><h2>{archived ? 'Saved reports' : 'Previous reports'}</h2>{historyError ? <p role="alert">{historyError}</p> : history.length ? history.map(item => <Report key={item.id} report={item} />) : <p>{archived ? 'No saved reports.' : 'No previous reports.'}</p>}</section>}
  </CoachingShell>
}
