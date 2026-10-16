import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import WorkoutDetails, { canEditWorkout, workoutStatus } from '../../components/coaching/WorkoutDetails.jsx'
import WorkoutPlanEditor, { emptyWorkout } from '../../components/coaching/WorkoutPlanEditor.jsx'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import { useUI } from '../../store/useUI.js'
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

const verifiedOccurrence = (workspace, saved) => {
  const current = (workspace?.occurrences || workspace?.workout?.occurrences || []).find(item => item.id === saved?.id)
  return !!current && current.version === saved.version && current.scheduledDate === saved.scheduledDate
    && current.state === saved.state && current.customized === saved.customized
}

const unverifiedChange = () => new Error('This change could not be verified. Reload the schedule and try again.')

export default function WorkoutPlans() {
  const { relationshipId } = useParams()
  return <ClientWorkoutPlans key={relationshipId} relationshipId={relationshipId} />
}

function ClientWorkoutPlans({ relationshipId }) {
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryHandled = useRef(null)
  const detailsRef = useRef(null)
  const editorRef = useRef(null)
  const [viewedOccurrenceId, setViewedOccurrenceId] = useState(null)
  const personalState = useStore(state => state.S)
  const { trainerWorkspace: loadedWorkspace, loadTrainerWorkspace, save } = useCoachingStore()
  const trainerWorkspace = loadedWorkspace?.relationship?.id === relationshipId ? loadedWorkspace : null
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
  const [removingPlan, setRemovingPlan] = useState(false)
  const [loadError, setLoadError] = useState('')
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
  const notify = message => { setStatus(message); useUI.getState().toast(message) }

  const refreshSources = () => Promise.all([
    coachingApi('/templates?kind=workout').then(setTemplates),
    coachingApi('/plan-sources?kind=workout&limit=20').then(setRecent)
  ]).catch(() => {})

  useEffect(() => {
    let active = true
    initializedFor.current = null
    loadTrainerWorkspace(relationshipId).catch(error => { if (active) setLoadError(error.message) })
    refreshSources()
    return () => { active = false }
  }, [relationshipId, loadTrainerWorkspace])

  useEffect(() => {
    if (!trainerWorkspace || trainerWorkspace.relationship?.id !== relationshipId || initializedFor.current === relationshipId) return
    initializedFor.current = relationshipId
    if (trainerWorkspace.workout?.content) setDraftState(cloneDraft(trainerWorkspace.workout.content))
    else setDraftState(emptyWorkout())
    setSelectedSource(trainerWorkspace.workout ? 'current' : 'blank')
    setSourceTemplateId(trainerWorkspace.workout?.sourceTemplateId || null)
    setComposerOpen(!trainerWorkspace.workout && !searchParams.has('occurrence'))
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
    notify('Source loaded into an independent draft')
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
      const published = await save(() => retryableCoachingMutation('/plans/publish', { relationshipId, kind: 'workout', expectedVersion: trainerWorkspace?.workoutAssignmentVersion || 0, sourceTemplateId, content: draft }))
      const workspace = await loadTrainerWorkspace(relationshipId)
      if (workspace?.workout?.revisionId !== published.revisionId || workspace.workoutAssignmentVersion !== published.version) throw unverifiedChange()
      await refreshSources()
      setDirty(false)
      setComposerOpen(false)
      notify('Published to client')
    } catch (error) {
      if (error.status === 409) { await loadTrainerWorkspace(relationshipId).catch(() => {}); setPublishConflict(true) }
      setStatus(error.status === 409 ? `${error.message}. The latest schedule is shown; your draft is preserved.` : error.message)
    }
  }

  const removePlan = () => confirmSheet({
    title: 'Delete this client workout plan?',
    message: 'Future unstarted workouts will be removed. Completed workout history stays available. You can assign a new plan later.',
    confirmText: 'Delete plan',
    danger: true,
    onConfirm: async () => {
      setRemovingPlan(true)
      setStatus('Deleting workout plan…')
      try {
        const removed = await save(() => retryableCoachingMutation('/plans/remove', { relationshipId, expectedVersion: trainerWorkspace?.workout?.version }))
        const workspace = await loadTrainerWorkspace(relationshipId)
        if (!workspace || workspace.workout || workspace.workoutAssignmentVersion !== removed.version) throw unverifiedChange()
        setDraftState(emptyWorkout())
        setSelectedSource('blank')
        setSourceTemplateId(null)
        setSelectedTemplateId(null)
        setTemplateName('')
        setDirty(false)
        setComposerOpen(true)
        notify('Workout plan deleted')
      } catch (error) {
        if (error.status === 409) await loadTrainerWorkspace(relationshipId).catch(() => {})
        setStatus(error.message)
      } finally { setRemovingPlan(false) }
    }
  })

  const saveAsTemplate = async () => {
    if (!templateName.trim()) { setStatus('Name the reusable template first.'); return }
    setStatus('Saving template…')
    try {
      const created = await coachingMutation('/templates', { kind: 'workout', name: templateName, content: draft })
      await refreshSources()
      setSelectedTemplateId(created.id)
      setSourceTemplateId(created.id)
      notify('Template saved')
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
      notify(archived ? 'Template archived' : 'Template updated')
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
      const saved = await coachingMutation(`/occurrences/${action}`, { occurrenceId: occurrence.id, expectedVersion: occurrence.version, ...(['move', 'restore'].includes(action) ? { scheduledDate } : {}), ...(action === 'customize' ? { prescription: null } : {}) })
      const workspace = await loadTrainerWorkspace(relationshipId)
      if (!verifiedOccurrence(workspace, saved)) throw unverifiedChange()
      setMoves(current => { const next = { ...current }; delete next[occurrence.id]; return next })
      setManagedOccurrenceId(null)
      notify(action === 'move' ? 'Workout rescheduled' : action === 'reset' ? 'Workout returned to its original date' : action === 'cancel' ? 'Day off saved' : action === 'customize' ? 'Workout returned to the recurring plan' : 'Workout restored')
    } catch (error) {
      if (error.status === 409) { await loadTrainerWorkspace(relationshipId).catch(() => {}); setOccurrenceConflicts(current => ({ ...current, [occurrence.id]: true })) }
      const message = error.status === 409 ? `${error.message}. Schedule reloaded.` : error.message
      setOccurrenceErrors(current => ({ ...current, [occurrence.id]: message }))
      setStatus(message)
    } finally { setSavingOccurrenceId(null) }
  }

  const openOccurrenceEditor = occurrence => {
    if (!canEditWorkout(occurrence, dateInZone(new Date(), trainerWorkspace?.relationship?.timeZone || 'UTC'))) return
    setEditingOccurrence(occurrence)
    setOccurrenceEditDraft(occurrenceDraft(occurrence))
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ block: 'start' }))
    setOccurrenceErrors(current => ({ ...current, [occurrence.id]: '' }))
  }

  const saveOccurrenceEdit = async () => {
    if (!editingOccurrence || !occurrenceEditDraft) return
    setSavingOccurrenceId(editingOccurrence.id)
    setOccurrenceErrors(current => ({ ...current, [editingOccurrence.id]: '' }))
    try {
      const saved = await coachingMutation('/occurrences/customize', { occurrenceId: editingOccurrence.id, expectedVersion: editingOccurrence.version, prescription: occurrencePrescription(occurrenceEditDraft) })
      const workspace = await loadTrainerWorkspace(relationshipId)
      if (!verifiedOccurrence(workspace, saved)) throw unverifiedChange()
      setEditingOccurrence(null)
      setOccurrenceEditDraft(null)
      setManagedOccurrenceId(null)
      notify('This workout was customized for one day')
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
    const rows = trainerWorkspace?.occurrences || trainerWorkspace?.workout?.occurrences || []
    return {
      upcoming: rows.filter(item => item.state === 'scheduled' && item.scheduledDate >= today).slice(0, 24),
      canceled: rows.filter(item => item.state === 'canceled' && item.cancellationReason === 'explicit' && item.scheduledDate >= today).slice(0, 24),
      past: rows.filter(item => item.scheduledDate < today || ['started', 'completed'].includes(item.state)).slice(-8).reverse()
    }
  }, [trainerWorkspace, today])

  const rows = trainerWorkspace?.occurrences || trainerWorkspace?.workout?.occurrences || []
  const viewedOccurrence = rows.find(item => item.id === viewedOccurrenceId)
  const viewOccurrence = occurrence => {
    setViewedOccurrenceId(occurrence.id)
    requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ block: 'start' }))
  }
  useEffect(() => {
    const id = searchParams.get('occurrence')
    const key = searchParams.toString()
    if (!trainerWorkspace || !id || queryHandled.current === key) return
    queryHandled.current = key
    const occurrence = (trainerWorkspace.occurrences || trainerWorkspace.workout?.occurrences || []).find(item => item.id === id)
    if (!occurrence) { setStatus('This workout is no longer available. Choose a workout from the schedule.'); return }
    setViewedOccurrenceId(id)
    if (searchParams.get('edit') === '1') openOccurrenceEditor(occurrence)
  }, [trainerWorkspace, searchParams])

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

  if (!trainerWorkspace) return <CoachingShell mode="trainer" title="Workout plan" eyebrow="Client" action={<Button onClick={() => nav(`/studio/clients/${relationshipId}`)}>Back</Button>}>
    <section className="coaching-panel"><p role={loadError ? 'alert' : 'status'}>{loadError || 'Loading client workout…'}</p></section>
  </CoachingShell>

  return <CoachingShell mode="trainer" title="Workout plan" eyebrow={trainerWorkspace?.client?.name || 'Client'} action={<Button onClick={() => nav(`/studio/clients/${relationshipId}`)}>Back</Button>}>
    {currentPlan && <section className="coaching-panel coaching-current-plan">
      <div><span className="coaching-kicker">Current plan</span><h2>{currentPlan.content.name}</h2><p>{currentPlan.content.days.length} training {currentPlan.content.days.length === 1 ? 'day' : 'days'} · future unstarted workouts follow this recurring plan.</p></div>
      <div className="coaching-actions"><Button onClick={() => revealComposer({ reloadCurrent: true })}>Edit recurring plan</Button><Button onClick={() => revealComposer()}>Use another plan</Button><Button variant="danger" disabled={removingPlan} onClick={removePlan}>{removingPlan ? 'Deleting…' : 'Delete workout plan'}</Button></div>
    </section>}

    {viewedOccurrence && <div ref={detailsRef}><WorkoutDetails occurrence={viewedOccurrence} timeZone={zone} today={today} onEdit={trainerWorkspace.relationship.status === 'active' ? openOccurrenceEditor : undefined} onClose={() => {
      setViewedOccurrenceId(null)
      if (searchParams.has('occurrence')) { const next = new URLSearchParams(searchParams); next.delete('occurrence'); next.delete('edit'); setSearchParams(next, { replace: true }) }
    }} /></div>}

    {!currentPlan && !composerOpen && <section className="coaching-panel"><h2>No recurring plan</h2><p>One-time workouts are listed in the schedule below.</p><Button onClick={() => revealComposer()}>Assign recurring plan</Button></section>}

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
          {(currentPlan || rows.length > 0) && <Button onClick={() => setComposerOpen(false)}>Close editor</Button>}
        </div>
        <div className="coaching-actions"><input aria-label="Template name" placeholder="Reusable template name" value={templateName} onChange={event => setTemplateName(event.target.value)} /><Button onClick={saveAsTemplate}>Save as new</Button>{selectedTemplateId && <><Button onClick={() => updateTemplate(false)}>Update template</Button><Button onClick={() => confirmSheet({ title: 'Archive template?', message: 'Existing client assignments stay unchanged.', confirmText: 'Archive', danger: true, onConfirm: () => updateTemplate(true) })}>Archive</Button></>}</div>
      </section>
      <section className="coaching-panel">
        <WorkoutPlanEditor value={draft} onChange={setDraft} onNotice={notify} />
        {publishConflict && <ConflictBanner message="Someone changed this client's schedule while you were editing. The latest schedule is shown; your draft is preserved." />}
        <div className="coaching-actions coaching-publish"><Button variant="primary" onClick={publish}>Publish to client</Button><span role="status">{status}{dirty ? ' · Draft has unpublished changes' : ''}</span></div>
      </section>
    </div>}

    {(currentPlan || rows.length > 0) && <section className="coaching-panel"><h2>Schedule manager</h2><p>Select a workout name to read its targets, or Manage to adjust one day. Started and completed workouts stay locked.</p>
      <OccurrenceGroup title="Upcoming" empty="No upcoming workouts." onView={viewOccurrence} rows={groups.upcoming} zone={zone} today={today} moves={moves} setMoves={setMoves} onAction={changeOccurrence} onEdit={openOccurrenceEditor} managedId={managedOccurrenceId} setManagedId={setManagedOccurrenceId} savingId={savingOccurrenceId} errors={occurrenceErrors} conflicts={occurrenceConflicts} />
      <OccurrenceGroup title="Days off" empty="No upcoming days off." onView={viewOccurrence} rows={groups.canceled} zone={zone} today={today} moves={moves} setMoves={setMoves} onAction={changeOccurrence} managedId={managedOccurrenceId} setManagedId={setManagedOccurrenceId} savingId={savingOccurrenceId} errors={occurrenceErrors} conflicts={occurrenceConflicts} />
      <OccurrenceGroup title="Past / locked" empty="No past workouts yet." onView={viewOccurrence} rows={groups.past} zone={zone} today={today} moves={moves} setMoves={setMoves} onAction={changeOccurrence} managedId={managedOccurrenceId} setManagedId={setManagedOccurrenceId} savingId={savingOccurrenceId} errors={occurrenceErrors} conflicts={occurrenceConflicts} />
    </section>}

    {editingOccurrence && occurrenceEditDraft && <section ref={editorRef} className="coaching-panel coaching-occurrence-editor-panel">
      <div className="coaching-panel-head"><div><span className="coaching-kicker">One-day change</span><h2>Edit {editingOccurrence.scheduledDate}</h2><p>Only this workout changes. The recurring plan and template stay unchanged.</p></div><Button onClick={() => { setEditingOccurrence(null); setOccurrenceEditDraft(null) }}>Close</Button></div>
      <WorkoutPlanEditor value={occurrenceEditDraft} onChange={setOccurrenceEditDraft} onNotice={notify} singleDay />
      {occurrenceErrors[editingOccurrence.id] && (occurrenceConflicts[editingOccurrence.id]
        ? <ConflictBanner message={occurrenceErrors[editingOccurrence.id]} />
        : <p className="coaching-error" role="alert">{occurrenceErrors[editingOccurrence.id]}</p>)}
      <div className="coaching-actions coaching-publish"><Button variant="primary" disabled={savingOccurrenceId === editingOccurrence.id} onClick={saveOccurrenceEdit}>{savingOccurrenceId === editingOccurrence.id ? 'Saving…' : 'Save this workout only'}</Button></div>
    </section>}

    {!composerOpen && status && <p className="coaching-save-status" role="status">{status}</p>}
  </CoachingShell>
}

function OccurrenceGroup({ title, empty, rows, zone, today, moves, setMoves, onAction, onEdit, onView, managedId, setManagedId, savingId, errors, conflicts }) {
  return <div className="coaching-schedule-group"><h3>{title}</h3>{!rows.length ? <p className="coaching-empty-inline">{empty}</p> : <div className="coaching-occurrence-list">{rows.map(item => {
    const mutable = item.scheduledDate >= today
    const status = workoutStatus(item, today)
    const canceled = item.state === 'canceled'
    const explicit = item.cancellationReason === 'explicit'
    const managed = managedId === item.id
    const busy = savingId === item.id
    const targetDate = moves[item.id] || item.scheduledDate
    return <div key={item.id} className={managed ? 'managed' : ''}>
      <div className="coaching-occurrence-summary"><span><button type="button" className="workout-details-link" onClick={() => onView(item)}>{item.prescription.dayName}</button><small>{item.scheduledDate} · {zone}{item.overrideDate ? ` · moved from ${item.originalDate}` : ''}</small></span><StatusBadge status={status.key} label={status.label} /></div>
      {mutable && (item.state === 'scheduled' || explicit) && <Button aria-expanded={managed} onClick={() => setManagedId(managed ? null : item.id)}>{managed ? 'Done' : 'Manage'}</Button>}
      {managed && <div className="coaching-occurrence-controls">
        {item.state === 'scheduled' && <>
          <Button disabled={busy} onClick={() => onEdit(item)}>Edit this workout</Button>
          <label><span>Reschedule date</span><input aria-label={`Reschedule ${item.prescription.dayName}`} type="date" min={today} value={targetDate} onChange={event => setMoves(current => ({ ...current, [item.id]: event.target.value }))} /></label>
          <Button disabled={busy || targetDate === item.scheduledDate} onClick={() => onAction(item, 'move')}>Save new date</Button>
          {item.overrideDate && <Button disabled={busy} onClick={() => onAction(item, 'reset')}>Return to original date</Button>}
          {item.customized && !item.oneTime && <Button disabled={busy} onClick={() => confirmSheet({ title: 'Return to the recurring workout?', message: 'This one-day customization will be removed and the current recurring workout will be used.', confirmText: 'Return to plan', onConfirm: () => onAction(item, 'customize') })}>Return workout to plan</Button>}
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
