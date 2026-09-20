import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import WorkoutPlanEditor, { emptyWorkout } from '../../components/coaching/WorkoutPlanEditor.jsx'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import { useStore } from '../../store/useStore.js'
import { coachingApi, coachingMutation, retryableCoachingMutation } from '../../lib/coaching/api.js'
import { dateInZone } from '../../lib/coaching/dates.js'
import { normalizeWorkoutDraft, personalPlanSource, starterPlanSource } from '../../lib/coaching/plan-sources.js'
import { confirmSheet } from '../../sheets.jsx'
import { Button, StatusBadge, ConflictBanner } from '../../components/ui.jsx'

const cloneDraft = value => normalizeWorkoutDraft(structuredClone(value))
const occurrenceDraft = occurrence => ({
  name: occurrence.prescription.planName,
  unit: occurrence.prescription.unit,
  days: [{
    id: occurrence.prescription.dayId,
    name: occurrence.prescription.dayName,
    weekdays: [1],
    exercises: structuredClone(occurrence.prescription.exercises || [])
  }]
})
const occurrencePrescription = draft => ({
  dayName: draft.days[0].name,
  unit: draft.unit,
  exercises: draft.days[0].exercises
})

export default function WorkoutPlans() {
  const { relationshipId } = useParams()
  const nav = useNavigate()
  const personalState = useStore(state => state.S)
  const { trainerWorkspace, loadTrainerWorkspace, save } = useCoachingStore()
  const initializedFor = useRef(null)
  const composerRef = useRef(null)
  const [draft, setDraftState] = useState(emptyWorkout)
  const [dirty, setDirty] = useState(false)
  const [templates, setTemplates] = useState([])
  const [recent, setRecent] = useState([])
  const [selectedSource, setSelectedSource] = useState('blank')
  const [sourceTemplateId, setSourceTemplateId] = useState(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [templateName, setTemplateName] = useState('')
  const [moves, setMoves] = useState({})
  const [status, setStatus] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [managedOccurrenceId, setManagedOccurrenceId] = useState(null)
  const [savingOccurrenceId, setSavingOccurrenceId] = useState(null)
  const [occurrenceErrors, setOccurrenceErrors] = useState({})
  const [editingOccurrence, setEditingOccurrence] = useState(null)
  const [occurrenceEditDraft, setOccurrenceEditDraft] = useState(null)
  // Which errors are specifically a 409 (someone else changed this schedule under
  // us) vs. a generic failure — FR-027 requires the conflict to be surfaced as a
  // conflict, not folded into the same plain-text status as any other error.
  const [publishConflict, setPublishConflict] = useState(false)
  const [occurrenceConflicts, setOccurrenceConflicts] = useState({})

  const refreshSources = () => Promise.all([
    coachingApi('/templates?kind=workout').then(setTemplates),
    coachingApi('/plan-sources?kind=workout&limit=20').then(setRecent)
  ]).catch(() => {})

  useEffect(() => {
    initializedFor.current = null
    loadTrainerWorkspace(relationshipId).catch(() => {})
    refreshSources()
  }, [relationshipId, loadTrainerWorkspace])

  useEffect(() => {
    if (!trainerWorkspace || trainerWorkspace.relationship?.id !== relationshipId || initializedFor.current === relationshipId) return
    initializedFor.current = relationshipId
    if (trainerWorkspace.workout?.content) setDraftState(cloneDraft(trainerWorkspace.workout.content))
    else setDraftState(emptyWorkout())
    setSelectedSource(trainerWorkspace.workout ? 'current' : 'blank')
    setSourceTemplateId(trainerWorkspace.workout?.sourceTemplateId || null)
    setComposerOpen(!trainerWorkspace.workout)
    setDirty(false)
  }, [trainerWorkspace, relationshipId])

  const setDraft = next => { setDraftState(next); setDirty(true) }
  const applySource = () => {
    let next = null
    let templateId = null
    let chosenTemplate = null
    if (selectedSource === 'blank') next = emptyWorkout()
    else if (selectedSource === 'personal') next = personalPlanSource(personalState)
    else if (selectedSource === 'starter') next = starterPlanSource(personalState)
    else if (selectedSource === 'current') {
      next = trainerWorkspace?.workout?.content
      templateId = trainerWorkspace?.workout?.sourceTemplateId || null
      chosenTemplate = templates.find(item => item.id === templateId) || null
    }
    else if (selectedSource.startsWith('template:')) {
      chosenTemplate = templates.find(item => item.id === selectedSource.slice(9))
      next = chosenTemplate?.content
      templateId = chosenTemplate?.id || null
    } else if (selectedSource.startsWith('recent:')) next = recent.find(item => item.id === selectedSource.slice(7))?.content
    if (!next?.days?.length) { setStatus('That source has no scheduled training days yet.'); return }
    setDraftState(cloneDraft(next))
    setSourceTemplateId(templateId)
    setSelectedTemplateId(chosenTemplate?.id || null)
    setTemplateName(chosenTemplate?.name || next.name || '')
    setDirty(true)
    setStatus('Source loaded into an independent draft')
  }
  const loadSource = () => {
    if (!dirty) { applySource(); return }
    confirmSheet({ title: 'Replace this draft?', message: 'Unsaved changes in this client draft will be replaced.', confirmText: 'Load source', onConfirm: applySource })
  }

  // Publishing replaces the recurring plan for every future unstarted occurrence —
  // explicitly a plan-replacing action, so FR-013 requires confirmation before it
  // applies, same as the schedule-manager's day-off/return-to-plan/archive actions below.
  const publish = () => confirmSheet({
    title: 'Publish this plan to the client?',
    message: 'Future unstarted workouts will follow this recurring plan. Started and completed workouts are not affected.',
    confirmText: 'Publish',
    onConfirm: doPublish
  })
  const doPublish = async () => {
    setStatus('Publishing future unstarted sessions…')
    setPublishConflict(false)
    try {
      await save(() => retryableCoachingMutation('/plans/publish', { relationshipId, kind: 'workout', expectedVersion: trainerWorkspace?.workout?.version || 0, sourceTemplateId, content: draft }))
      await loadTrainerWorkspace(relationshipId)
      await refreshSources()
      setDirty(false)
      setComposerOpen(false)
      setStatus('Published to client')
    } catch (error) {
      if (error.status === 409) { await loadTrainerWorkspace(relationshipId).catch(() => {}); setPublishConflict(true) }
      setStatus(error.status === 409 ? `${error.message}. The latest schedule is shown; your draft is preserved.` : error.message)
    }
  }

  const saveAsTemplate = async () => {
    if (!templateName.trim()) { setStatus('Name the reusable template first.'); return }
    setStatus('Saving template…')
    try {
      const created = await coachingMutation('/templates', { kind: 'workout', name: templateName, content: draft })
      await refreshSources()
      setSelectedTemplateId(created.id)
      setSourceTemplateId(created.id)
      setStatus('Template saved')
    } catch (error) { setStatus(error.message) }
  }

  const updateTemplate = async (archived = false) => {
    const selected = templates.find(item => item.id === selectedTemplateId)
    if (!selected) return
    setStatus(archived ? 'Archiving template…' : 'Updating template…')
    try {
      await coachingMutation('/templates', { templateId: selected.id, expectedVersion: selected.version, name: templateName || selected.name, content: draft, archived }, { method: 'PUT' })
      await refreshSources()
      if (archived) { setSelectedTemplateId(null); setSourceTemplateId(null) }
      setStatus(archived ? 'Template archived' : 'Template updated')
    } catch (error) { setStatus(error.message) }
  }

  const changeOccurrence = async (occurrence, action) => {
    const labels = { move: 'Rescheduling', reset: 'Returning to the original date', cancel: 'Saving day off', restore: 'Restoring', customize: 'Returning to the recurring workout' }
    setSavingOccurrenceId(occurrence.id)
    setOccurrenceErrors(current => ({ ...current, [occurrence.id]: '' }))
    setOccurrenceConflicts(current => ({ ...current, [occurrence.id]: false }))
    setStatus(`${labels[action]} session…`)
    try {
      const scheduledDate = moves[occurrence.id] || occurrence.scheduledDate
      await coachingMutation(`/occurrences/${action}`, { occurrenceId: occurrence.id, expectedVersion: occurrence.version, ...(['move', 'restore'].includes(action) ? { scheduledDate } : {}), ...(action === 'customize' ? { prescription: null } : {}) })
      await loadTrainerWorkspace(relationshipId)
      setMoves(current => { const next = { ...current }; delete next[occurrence.id]; return next })
      setManagedOccurrenceId(null)
      setStatus(action === 'move' ? 'Workout rescheduled' : action === 'reset' ? 'Workout returned to its original date' : action === 'cancel' ? 'Day off saved' : action === 'customize' ? 'Workout returned to the recurring plan' : 'Workout restored')
    } catch (error) {
      if (error.status === 409) { await loadTrainerWorkspace(relationshipId).catch(() => {}); setOccurrenceConflicts(current => ({ ...current, [occurrence.id]: true })) }
      const message = error.status === 409 ? `${error.message}. Schedule reloaded.` : error.message
      setOccurrenceErrors(current => ({ ...current, [occurrence.id]: message }))
      setStatus(message)
    } finally { setSavingOccurrenceId(null) }
  }

  const openOccurrenceEditor = occurrence => {
    setEditingOccurrence(occurrence)
    setOccurrenceEditDraft(occurrenceDraft(occurrence))
    setOccurrenceErrors(current => ({ ...current, [occurrence.id]: '' }))
  }

  const saveOccurrenceEdit = async () => {
    if (!editingOccurrence || !occurrenceEditDraft) return
    setSavingOccurrenceId(editingOccurrence.id)
    setOccurrenceErrors(current => ({ ...current, [editingOccurrence.id]: '' }))
    try {
      await coachingMutation('/occurrences/customize', { occurrenceId: editingOccurrence.id, expectedVersion: editingOccurrence.version, prescription: occurrencePrescription(occurrenceEditDraft) })
      await loadTrainerWorkspace(relationshipId)
      setEditingOccurrence(null)
      setOccurrenceEditDraft(null)
      setManagedOccurrenceId(null)
      setStatus('This workout was customized for one day')
    } catch (error) {
      if (error.status === 409) { await loadTrainerWorkspace(relationshipId).catch(() => {}); setOccurrenceConflicts(current => ({ ...current, [editingOccurrence.id]: true })) }
      const message = error.status === 409 ? `${error.message}. Schedule reloaded; your edit is preserved.` : error.message
      setOccurrenceErrors(current => ({ ...current, [editingOccurrence.id]: message }))
      setStatus(message)
    } finally { setSavingOccurrenceId(null) }
  }

  const zone = trainerWorkspace?.relationship?.timeZone || 'UTC'
  const today = dateInZone(new Date(), zone)
  const groups = useMemo(() => {
    const rows = trainerWorkspace?.workout?.occurrences || []
    return {
      upcoming: rows.filter(item => item.state === 'scheduled' && item.scheduledDate >= today).slice(0, 24),
      canceled: rows.filter(item => item.state === 'canceled' && item.cancellationReason === 'explicit' && item.scheduledDate >= today).slice(0, 24),
      past: rows.filter(item => item.scheduledDate < today || ['started', 'completed'].includes(item.state)).slice(-8).reverse()
    }
  }, [trainerWorkspace, today])

  const currentPlan = trainerWorkspace?.workout
  const revealComposer = ({ reloadCurrent = false } = {}) => {
    if (reloadCurrent && currentPlan?.content) {
      setDraftState(cloneDraft(currentPlan.content))
      setSelectedSource('current')
      setSourceTemplateId(currentPlan.sourceTemplateId || null)
      setSelectedTemplateId(currentPlan.sourceTemplateId || null)
      setTemplateName(templates.find(item => item.id === currentPlan.sourceTemplateId)?.name || currentPlan.content.name || '')
      setDirty(false)
    }
    setComposerOpen(true)
    requestAnimationFrame(() => composerRef.current?.scrollIntoView({ block: 'start' }))
  }

  return <CoachingShell mode="trainer" title="Workout plan" eyebrow={trainerWorkspace?.client?.name || 'Client'} action={<Button onClick={() => nav(`/studio/clients/${relationshipId}`)}>Back</Button>}>
    {currentPlan && <section className="coaching-panel coaching-current-plan">
      <div><span className="coaching-kicker">Current plan</span><h2>{currentPlan.content.name}</h2><p>{currentPlan.content.days.length} training days · future unstarted workouts follow this recurring plan.</p></div>
      <div className="coaching-actions"><Button onClick={() => revealComposer({ reloadCurrent: true })}>Edit recurring plan</Button><Button onClick={() => revealComposer()}>Use another plan</Button></div>
    </section>}

    {composerOpen && <div ref={composerRef} className="coaching-composer">
      <section className="coaching-panel coaching-template-bar">
        <div><h2>Start from a plan</h2><p>Load a copy from templates, your personal plan, Starter PPL, or a recent assignment.</p></div>
        <div className="coaching-actions">
          <select aria-label="Plan source" value={selectedSource} onChange={event => setSelectedSource(event.target.value)}>
            <option value="blank">Blank plan</option>
            {currentPlan && <option value="current">Current client assignment</option>}
            <option value="personal">My personal plan</option>
            <option value="starter">Starter PPL</option>
            {templates.map(item => <option key={item.id} value={`template:${item.id}`}>Template: {item.name}</option>)}
            {recent.map(item => <option key={item.id} value={`recent:${item.id}`}>Recent: {item.planName} · {item.clientName}</option>)}
          </select>
          <Button onClick={loadSource}>Load source</Button>
          {currentPlan && <Button onClick={() => setComposerOpen(false)}>Close editor</Button>}
        </div>
        <div className="coaching-actions"><input aria-label="Template name" placeholder="Reusable template name" value={templateName} onChange={event => setTemplateName(event.target.value)} /><Button onClick={saveAsTemplate}>Save as new</Button>{selectedTemplateId && <><Button onClick={() => updateTemplate(false)}>Update template</Button><Button onClick={() => confirmSheet({ title: 'Archive template?', message: 'Existing client assignments stay unchanged.', confirmText: 'Archive', danger: true, onConfirm: () => updateTemplate(true) })}>Archive</Button></>}</div>
      </section>
      <section className="coaching-panel">
        <WorkoutPlanEditor value={draft} onChange={setDraft} />
        {publishConflict && <ConflictBanner message="Someone changed this client's schedule while you were editing. The latest schedule is shown; your draft is preserved." />}
        <div className="coaching-actions coaching-publish"><Button variant="primary" onClick={publish}>Publish to client</Button><span role="status">{status}{dirty ? ' · Draft has unpublished changes' : ''}</span></div>
      </section>
    </div>}

    {currentPlan && <section className="coaching-panel"><h2>Schedule manager</h2><p>Use Manage to adjust one day. Started and completed workouts stay locked.</p>
      <OccurrenceGroup title="Upcoming" empty="No upcoming workouts." rows={groups.upcoming} zone={zone} today={today} moves={moves} setMoves={setMoves} onAction={changeOccurrence} onEdit={openOccurrenceEditor} managedId={managedOccurrenceId} setManagedId={setManagedOccurrenceId} savingId={savingOccurrenceId} errors={occurrenceErrors} conflicts={occurrenceConflicts} />
      <OccurrenceGroup title="Days off" empty="No upcoming days off." rows={groups.canceled} zone={zone} today={today} moves={moves} setMoves={setMoves} onAction={changeOccurrence} managedId={managedOccurrenceId} setManagedId={setManagedOccurrenceId} savingId={savingOccurrenceId} errors={occurrenceErrors} conflicts={occurrenceConflicts} />
      <OccurrenceGroup title="Past / locked" empty="No past workouts yet." rows={groups.past} zone={zone} today={today} moves={moves} setMoves={setMoves} onAction={changeOccurrence} managedId={managedOccurrenceId} setManagedId={setManagedOccurrenceId} savingId={savingOccurrenceId} errors={occurrenceErrors} conflicts={occurrenceConflicts} />
    </section>}

    {editingOccurrence && occurrenceEditDraft && <section className="coaching-panel coaching-occurrence-editor-panel">
      <div className="coaching-panel-head"><div><span className="coaching-kicker">One-day change</span><h2>Edit {editingOccurrence.scheduledDate}</h2><p>Only this workout changes. The recurring plan and template stay unchanged.</p></div><Button onClick={() => { setEditingOccurrence(null); setOccurrenceEditDraft(null) }}>Close</Button></div>
      <WorkoutPlanEditor value={occurrenceEditDraft} onChange={setOccurrenceEditDraft} singleDay />
      {occurrenceErrors[editingOccurrence.id] && (occurrenceConflicts[editingOccurrence.id]
        ? <ConflictBanner message={occurrenceErrors[editingOccurrence.id]} />
        : <p className="coaching-error" role="alert">{occurrenceErrors[editingOccurrence.id]}</p>)}
      <div className="coaching-actions coaching-publish"><Button variant="primary" disabled={savingOccurrenceId === editingOccurrence.id} onClick={saveOccurrenceEdit}>{savingOccurrenceId === editingOccurrence.id ? 'Saving…' : 'Save this workout only'}</Button></div>
    </section>}

    {!composerOpen && status && <p className="coaching-save-status" role="status">{status}</p>}
  </CoachingShell>
}

function occurrenceStatus(item) {
  if (item.state === 'completed') return 'Completed'
  if (item.state === 'started') return 'In progress'
  if (item.state === 'canceled') return item.cancellationReason === 'explicit' ? 'Day off' : 'Removed by plan'
  if (item.customized && item.overrideDate) return 'Customized · Rescheduled'
  if (item.customized) return 'Customized'
  if (item.overrideDate) return 'Rescheduled'
  return 'Scheduled'
}

// Same derivation, mapped to StatusBadge's status vocabulary (FR-025) —
// the label text above is untouched, this only picks the badge's icon/tone.
function occurrenceStatusKey(item) {
  if (item.state === 'completed') return 'completed'
  if (item.state === 'started') return 'in-progress'
  if (item.state === 'canceled') return 'day-off'
  if (item.customized) return 'customized'
  if (item.overrideDate) return 'rescheduled'
  return 'scheduled'
}

function OccurrenceGroup({ title, empty, rows, zone, today, moves, setMoves, onAction, onEdit, managedId, setManagedId, savingId, errors, conflicts }) {
  return <div className="coaching-schedule-group"><h3>{title}</h3>{!rows.length ? <p className="coaching-empty-inline">{empty}</p> : <div className="coaching-occurrence-list">{rows.map(item => {
    const mutable = item.scheduledDate >= today
    const canceled = item.state === 'canceled'
    const explicit = item.cancellationReason === 'explicit'
    const managed = managedId === item.id
    const busy = savingId === item.id
    const targetDate = moves[item.id] || item.scheduledDate
    return <div key={item.id} className={managed ? 'managed' : ''}>
      <div className="coaching-occurrence-summary"><span><strong>{item.prescription.dayName}</strong><small>{item.scheduledDate} · {zone}{item.overrideDate ? ` · moved from ${item.originalDate}` : ''}</small></span><StatusBadge status={occurrenceStatusKey(item)} label={occurrenceStatus(item)} /></div>
      {mutable && (item.state === 'scheduled' || explicit) && <Button aria-expanded={managed} onClick={() => setManagedId(managed ? null : item.id)}>{managed ? 'Done' : 'Manage'}</Button>}
      {managed && <div className="coaching-occurrence-controls">
        {item.state === 'scheduled' && <>
          <Button disabled={busy} onClick={() => onEdit(item)}>Edit this workout</Button>
          <label><span>Reschedule date</span><input aria-label={`Reschedule ${item.prescription.dayName}`} type="date" min={today} value={targetDate} onChange={event => setMoves(current => ({ ...current, [item.id]: event.target.value }))} /></label>
          <Button disabled={busy || targetDate === item.scheduledDate} onClick={() => onAction(item, 'move')}>Save new date</Button>
          {item.overrideDate && <Button disabled={busy} onClick={() => onAction(item, 'reset')}>Return to original date</Button>}
          {item.customized && <Button disabled={busy} onClick={() => confirmSheet({ title: 'Return to the recurring workout?', message: 'This one-day customization will be removed and the current recurring workout will be used.', confirmText: 'Return to plan', onConfirm: () => onAction(item, 'customize') })}>Return workout to plan</Button>}
          <Button disabled={busy} onClick={() => confirmSheet({ title: 'Give this client a day off?', message: `${item.prescription.dayName} on ${item.scheduledDate} will become a day off and can be restored later.`, confirmText: 'Give day off', danger: true, onConfirm: () => onAction(item, 'cancel') })}>Give day off</Button>
        </>}
        {canceled && explicit && <>
          <label><span>Restore date</span><input aria-label={`Restore ${item.prescription.dayName}`} type="date" min={today} value={targetDate} onChange={event => setMoves(current => ({ ...current, [item.id]: event.target.value }))} /></label>
          <Button disabled={busy} onClick={() => onAction(item, 'restore')}>{targetDate === item.scheduledDate ? 'Restore on this date' : 'Restore on selected date'}</Button>
        </>}
        {errors[item.id] && (conflicts[item.id]
          ? <ConflictBanner message={errors[item.id]} />
          : <p className="coaching-error" role="alert">{errors[item.id]}</p>)}
      </div>}
      {(!mutable || ['started', 'completed'].includes(item.state) || (canceled && !explicit)) && <span className="coaching-lock-note">This workout cannot be changed.</span>}
    </div>
  })}</div>}</div>
}
