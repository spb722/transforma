import { useEffect, useMemo, useRef, useState } from 'react'
import WorkoutPlanEditor from './WorkoutPlanEditor.jsx'
import { Button } from '../ui.jsx'
import { coachingApi, mutationId, retryableCoachingMutation } from '../../lib/coaching/api.js'
import { dateInZone } from '../../lib/coaching/dates.js'
import { assignedTargetLabel } from '../../lib/coaching/logger.js'
import { normalizeWorkoutDraft } from '../../lib/coaching/plan-sources.js'
import { confirmSheet } from '../../sheets.jsx'
import './editor.css'
import './one-time-workout.css'

const blank = () => ({ name: 'One-time workout', unit: 'kg', days: [{ id: crypto.randomUUID(), name: 'Extra workout', weekdays: [1], exercises: [] }] })

export default function OneTimeWorkout({ workspace, initialDate, onPublished, onClose }) {
  const today = dateInZone(new Date(), workspace.relationship.timeZone)
  const [date, setDate] = useState(initialDate || today)
  const [draft, setDraft] = useState(blank)
  const [templates, setTemplates] = useState([])
  const [source, setSource] = useState('blank')
  const [stage, setStage] = useState('source')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sourceError, setSourceError] = useState('')
  const [saved, setSaved] = useState(null)
  const request = useRef(null)
  const heading = useRef(null)
  const occurrences = workspace.occurrences || workspace.workout?.occurrences || []
  const conflict = occurrences.find(item => item.scheduledDate === date && item.state !== 'canceled')
  const sources = useMemo(() => [
    ...templates.flatMap(template => (template.content?.days || []).map(day => ({ id: `template:${template.id}:${day.id}`, label: `${template.name} · ${day.name}`, unit: template.content.unit, day }))),
    ...(workspace.workout?.content?.days || []).map(day => ({ id: `plan:${day.id}`, label: `Current plan · ${day.name}`, unit: workspace.workout.content.unit, day })),
    ...occurrences.filter(item => item.prescription?.exercises?.length).slice().reverse().slice(0, 30).map(item => ({ id: `date:${item.id}`, label: `${item.scheduledDate} · ${item.prescription.dayName}`, unit: item.prescription.unit, day: { id: item.prescription.dayId, name: item.prescription.dayName, exercises: item.prescription.exercises } }))
  ], [templates, workspace.workout, occurrences])

  useEffect(() => {
    let active = true
    coachingApi('/templates?kind=workout').then(items => { if (active) setTemplates(items) }).catch(() => { if (active) setSourceError('Templates could not load. You can still copy this client’s workout or start blank.') })
    return () => { active = false }
  }, [])
  useEffect(() => { heading.current?.focus() }, [stage, saved])

  const changeDraft = next => { setDraft(next); request.current = null; setError('') }
  const loadSource = () => {
    const selected = sources.find(item => item.id === source)
    if (source !== 'blank' && !selected) { setError('Choose an available workout source.'); return }
    changeDraft(selected ? normalizeWorkoutDraft({ name: 'One-time workout', unit: selected.unit, days: [{ ...structuredClone(selected.day), id: crypto.randomUUID(), weekdays: [1] }] }) : blank())
    setStage('edit')
  }
  const review = () => {
    if (!date || date < today) { setError('Choose today or a future date.'); return }
    if (conflict) { setError('That date already has a workout. Choose an empty date or manage the existing workout.'); return }
    if (!draft.days[0].name.trim() || draft.days[0].name.trim().length > 100 || !draft.days[0].exercises.length) { setError('Give this workout a name of up to 100 characters and add at least one exercise.'); return }
    setError(''); setStage('review')
  }
  const publish = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (!request.current) request.current = { mutationId: mutationId(), relationshipId: workspace.relationship.id, scheduledDate: date, prescription: { dayName: draft.days[0].name, unit: draft.unit, exercises: draft.days[0].exercises } }
      const result = await retryableCoachingMutation('/occurrences/create', request.current)
      setSaved(result)
      await onPublished?.(result)
    } catch (failure) {
      setError(failure.code === 'DATE_OCCUPIED' ? 'Another workout now occupies this date. Go back and choose an empty date. Your draft is saved here.' : failure.message || 'Unable to publish. Retry with this draft.')
    } finally { setBusy(false) }
  }
  const close = () => {
    if (saved || !draft.days[0].exercises.length) { onClose?.(); return }
    confirmSheet({ title: 'Discard this workout draft?', message: 'This one-time workout has not been published.', confirmText: 'Discard draft', onConfirm: onClose })
  }

  return <section className="one-time-workout" aria-label="Assign workout for a date">
    <div className="one-time-heading"><div><span className="one-time-eyebrow">One date only</span><h2 tabIndex={-1} ref={heading}>{saved ? 'Workout published' : stage === 'review' ? 'Review this workout' : 'Assign workout for a date'}</h2></div><Button type="button" disabled={busy} onClick={close}>{saved ? 'Done' : 'Close'}</Button></div>
    {saved ? <p role="status"><strong>{saved.prescription.dayName}</strong> is assigned for {saved.scheduledDate}. The client can start it on that date. Future weeks stay the same.</p> : <>
      <p className="one-time-hint">Give {workspace.client.name} a workout for one date. Their recurring plan and source template stay the same.</p>
      <fieldset disabled={busy}>
        {stage !== 'review' && <label className="one-time-date"><span>Workout date · {workspace.relationship.timeZone}</span><input type="date" min={today} value={date} onChange={event => { setDate(event.target.value); request.current = null; setError('') }} /></label>}
        {conflict && stage !== 'review' && <p className="one-time-error" role="status">{conflict.prescription?.dayName || 'Another workout'} already occupies this date. Choose an empty date.</p>}
        {stage === 'source' && <>
          <label className="one-time-source"><span>Start from</span><select value={source} onChange={event => setSource(event.target.value)}><option value="blank">Blank workout</option>{sources.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          {sourceError && <p role="status">{sourceError}</p>}
          <Button type="button" variant="primary" onClick={() => draft.days[0].exercises.length ? confirmSheet({ title: 'Replace this draft?', message: 'Loading a source replaces the exercises in your current draft.', confirmText: 'Load workout', onConfirm: loadSource }) : loadSource()}>Continue to workout</Button>
          {!!draft.days[0].exercises.length && <Button type="button" onClick={() => setStage('edit')}>Keep current draft</Button>}
        </>}
        {stage === 'edit' && <>
          <WorkoutPlanEditor value={draft} onChange={changeDraft} singleDay />
          <div className="one-time-actions"><Button type="button" onClick={() => setStage('source')}>Change source</Button><Button type="button" variant="primary" disabled={!!conflict} onClick={review}>Review workout</Button></div>
        </>}
        {stage === 'review' && <>
          <div className="one-time-review"><p><strong>{draft.days[0].name}</strong><br />{date} · {workspace.relationship.timeZone}</p><ol>{draft.days[0].exercises.map(exercise => <li key={exercise.entryId}><strong>{exercise.name}</strong><ul>{exercise.sets.map((set, index) => <li key={index}>Set {index + 1}: {assignedTargetLabel(exercise, set, draft.unit)}</li>)}</ul><span>Rest: {exercise.restSec || 0} seconds</span>{exercise.notes && <p>{exercise.notes}</p>}</li>)}</ol></div>
          <div className="one-time-actions"><Button type="button" onClick={() => setStage('edit')}>Back to edit</Button><Button type="button" variant="primary" onClick={publish}>{busy ? 'Publishing…' : 'Publish one-time workout'}</Button></div>
        </>}
      </fieldset>
    </>}
    {error && <p className="one-time-error" role="alert">{error}</p>}
  </section>
}
