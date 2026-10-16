import { useEffect, useRef, useState } from 'react'
import { Button, TextArea } from '../ui.jsx'
import { useStore } from '../../store/useStore.js'
import { coachingApi, mutationId } from '../../lib/coaching/api.js'
import { feedbackDraft, storeFeedbackDraft, sendSessionFeedback, reloadedFeedbackDraft } from '../../lib/coaching/session-feedback.js'
import './session-feedback.css'

const contentOf = feedback => ({ note: feedback?.note || '', difficulty: feedback?.difficulty ?? null, pain: feedback?.pain ?? null })

export default function SessionFeedback({ sessionId, mode = 'client' }) {
  const userId = useStore(state => state.user?.id)
  if (!userId) return null
  return <SessionFeedbackEditor key={`${userId}:${sessionId}:${mode}`} userId={userId} sessionId={sessionId} mode={mode} />
}

function SessionFeedbackEditor({ userId, sessionId, mode }) {
  const alive = useRef(false)
  const current = () => alive.current && useStore.getState().user?.id === userId
  const [feedback, setFeedback] = useState(null)
  const [content, setContent] = useState(contentOf(null))
  const [response, setResponse] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    alive.current = true
    setLoaded(false)
    setError('')
    const draft = mode === 'client' ? feedbackDraft(userId, sessionId) : null
    if (draft) { setContent(draft.content); setStatus('Draft saved on this device. Send it when you are ready.') }
    coachingApi(`/sessions/feedback?sessionId=${encodeURIComponent(sessionId)}`, { signal: controller.signal }).then(value => {
      if (controller.signal.aborted || !current()) return
      setFeedback(value); setResponse(value.response || ''); setLoaded(true)
      if (!draft) setContent(contentOf(value))
    }).catch(error => { if (!controller.signal.aborted && current() && error.name !== 'AbortError') setError('Feedback could not load. Your workout result is saved separately. Reopen this workout when online to send your note.') })
    return () => { alive.current = false; controller.abort() }
  }, [sessionId, userId, mode])

  function edit(field, value) {
    if (!current()) return
    const next = { ...content, [field]: value }
    setContent(next); setStatus(''); setError('')
    try {
      const previous = feedbackDraft(userId, sessionId)
      // A lost response must be retried with the same mutation identity.
      if (previous?.request) { setError('Retry sending the previous note before editing it.'); setContent(previous.content); return }
      storeFeedbackDraft(userId, sessionId, { content: next, version: feedback?.version ?? 0 })
      setStatus('Draft saved on this device. Tap Send feedback to share it.')
    } catch { setError('This device could not save the draft. Keep this screen open and send it while online.') }
  }

  async function save() {
    if (!current() || !loaded || busy) return
    setBusy(true); setError(''); setStatus('')
    try {
      let value
      if (mode === 'trainer') value = await coachingApi('/sessions/feedback/review', { method: 'POST', body: { sessionId, expectedVersion: feedback.version, response, mutationId: mutationId() } })
      else {
        const draft = feedbackDraft(userId, sessionId)
        value = await sendSessionFeedback(userId, sessionId, draft?.request ? draft : { content, version: feedback.version })
      }
      if (!current()) return
      setFeedback(value); setConflict(false); setStatus(mode === 'trainer' ? 'Feedback reviewed. Your reply is visible to the client.' : 'Feedback sent to your trainer.')
    } catch (error) {
      if (!current()) return
      setConflict(error.code === 'VERSION_CONFLICT')
      setError(error.code === 'VERSION_CONFLICT' ? 'Feedback changed on another screen. Reload the latest feedback before sending again. Your draft is kept.' : mode === 'client' ? `${error.message}. Your note is kept on this device. Retry when online, after the workout result syncs.` : error.message)
    } finally { if (current()) setBusy(false) }
  }

  async function reload() {
    if (!current() || busy) return
    setBusy(true)
    try {
      const value = await coachingApi(`/sessions/feedback?sessionId=${encodeURIComponent(sessionId)}`)
      if (!current()) return
      setFeedback(value); setLoaded(true); setConflict(false); setError('')
      if (mode === 'client') {
        const draft = reloadedFeedbackDraft(feedbackDraft(userId, sessionId), content, value.version, conflict)
        storeFeedbackDraft(userId, sessionId, draft)
        setContent(draft.content)
      }
      else setResponse(value.response || '')
      setStatus('Latest feedback loaded. Review your note before sending again.')
    } catch (error) { if (current()) setError(error.message) } finally { if (current()) setBusy(false) }
  }

  return <section className="session-feedback" aria-label="Workout feedback">
    <h3>Workout feedback {feedback?.needsAttention && <small>Needs review</small>}</h3>
    {mode === 'client' ? <>
      <p>Optional. Tell your trainer how this workout felt. You can edit this later in workout history or Progress.</p>
      <label>Note to your trainer<TextArea rows={3} maxLength={1000} value={content.note} disabled={busy} onChange={event => edit('note', event.target.value)} placeholder="What felt good, difficult, or uncomfortable?" /></label>
      <div className="session-feedback-ratings">
        <label>Difficulty<select value={content.difficulty ?? ''} disabled={busy} onChange={event => edit('difficulty', event.target.value === '' ? null : Number(event.target.value))}><option value="">Not rated</option>{['1 · Very easy', '2 · Easy', '3 · Moderate', '4 · Hard', '5 · Very hard'].map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></label>
        <label>Pain (0 none, 10 worst)<select value={content.pain ?? ''} disabled={busy} onChange={event => edit('pain', event.target.value === '' ? null : Number(event.target.value))}><option value="">Not rated</option>{Array.from({ length: 11 }, (_, index) => <option key={index} value={index}>{index}{index === 0 ? ' · None' : index === 10 ? ' · Worst' : ''}</option>)}</select></label>
      </div>
    </> : <>
      {!feedback?.version ? <p>No workout feedback yet.</p> : <>
        <p className="session-feedback-note">{feedback.note || 'No written note.'}</p>
        <p>Difficulty: {feedback.difficulty == null ? 'not rated' : `${feedback.difficulty}/5`} · Pain: {feedback.pain == null ? 'not rated' : `${feedback.pain}/10`}</p>
        <label>Reply to client (optional)<TextArea rows={3} maxLength={1000} value={response} disabled={busy} onChange={event => setResponse(event.target.value)} /></label>
      </>}
    </>}
    {mode === 'client' && feedback?.response && <div className="session-feedback-reply"><strong>Trainer reply{!feedback.reviewedAt ? ' to earlier feedback' : ''}</strong><p>{feedback.response}</p></div>}
    {feedback?.reviewedAt && <p className="small muted">Reviewed {new Date(feedback.reviewedAt).toLocaleString()}</p>}
    {error && <p role="alert" className="coaching-error">{error}</p>}
    {status && <p role="status" className="small">{status}</p>}
    <div className="session-feedback-actions">
      {(mode === 'client' || feedback?.version > 0) && <Button variant="primary" disabled={busy || !loaded || conflict} onClick={save}>{busy ? 'Saving…' : mode === 'trainer' ? response.trim() ? 'Reply and mark reviewed' : 'Mark reviewed' : feedback?.version ? 'Update feedback' : 'Send feedback'}</Button>}
      {(conflict || !loaded) && <Button disabled={busy} onClick={reload}>Reload feedback</Button>}
    </div>
  </section>
}
