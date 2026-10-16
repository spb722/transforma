import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import { coachingMutation } from '../../lib/coaching/api.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import ContactTrainer from '../../components/coaching/ContactTrainer.jsx'
import ContactClient from '../../components/coaching/ContactClient.jsx'
import TodayWorkoutCard from '../../components/coaching/TodayWorkoutCard.jsx'
import WorkoutDetails from '../../components/coaching/WorkoutDetails.jsx'
import OneTimeWorkout from '../../components/coaching/OneTimeWorkout.jsx'
import { dateInZone } from '../../lib/coaching/dates.js'
import { Button, Skeleton } from '../../components/ui.jsx'
import { confirmSheet } from '../../sheets.jsx'
import { ownAssignmentSchedule } from '../../lib/coaching/schedule.js'

export default function ClientWorkspace({ mode }) {
  const { relationshipId } = useParams()
  const nav = useNavigate()
  const store = useCoachingStore()
  const accountId = store.userId
  const [failure, setFailure] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const requestId = useRef(0)
  const mounted = useRef(false)
  const workspaceError = failure?.accountId === accountId && failure.relationshipId === relationshipId && failure.mode === mode ? failure.error : null
  const loaded = mode === 'trainer' ? store.trainerWorkspace : store.ownViewedWorkspace
  const connectionFailure = workspaceError && (workspaceError.status == null || workspaceError.status === 0 || workspaceError.status === 408 || workspaceError.status >= 500)
  const cached = mode === 'client' && connectionFailure && store.ownWorkspace?.relationship?.id === relationshipId ? store.ownWorkspace : null
  const workspace = loaded?.relationship?.id === relationshipId ? loaded : cached
  const [ending, setEnding] = useState(false)
  const [startError, setStartError] = useState('')
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState(null)
  const [assignDate, setAssignDate] = useState(null)
  useEffect(() => { setSelectedOccurrenceId(null); setAssignDate(null); setStartError('') }, [accountId, relationshipId, mode])
  const load = mode === 'trainer' ? store.loadTrainerWorkspace : store.loadOwnWorkspace
  // Another coaching request can clear the shared error before this screen renders it.
  const refreshWorkspace = useCallback(async () => {
    if (!accountId) return
    const request = ++requestId.current
    const current = () => mounted.current && request === requestId.current && useCoachingStore.getState().userId === accountId
    setRefreshing(true)
    try {
      const updated = await load(relationshipId)
      if (current() && updated) setFailure(null)
    } catch (error) {
      if (current()) setFailure({ accountId, relationshipId, mode, error })
    } finally {
      if (current()) setRefreshing(false)
    }
  }, [accountId, load, relationshipId, mode])
  useEffect(() => {
    mounted.current = true
    refreshWorkspace()
    store.startRevalidation(refreshWorkspace)
    return () => {
      mounted.current = false
      requestId.current += 1
      store.stopRevalidation()
    }
  }, [refreshWorkspace, store.startRevalidation, store.stopRevalidation])
  // Was a native window.confirm() — the one unstyled, unthemed dialog left in the
  // coaching surface, and the most destructive action in it. Matches the rest of
  // the app's confirmSheet pattern (e.g. "Give day off" in the schedule manager).
  const end = () => confirmSheet({
    title: 'End this coaching relationship?',
    message: 'The client keeps their records and trainer access stops immediately.',
    confirmText: 'End coaching',
    danger: true,
    onConfirm: async () => {
      setEnding(true)
      try {
        await coachingMutation('/relationships/end', { relationshipId, expectedVersion: workspace.relationship.version })
        store.clearTrainerData()
        nav(mode === 'trainer' ? '/studio' : '/coaching', { replace: true })
      } catch (error) { setStartError(error.message) } finally { setEnding(false) }
    }
  })
  const visibleSchedule = workspace ? ownAssignmentSchedule(workspace) : { upcoming: [], canceled: [], past: [] }
  const rows = workspace?.occurrences || workspace?.workout?.occurrences || []
  const selectedOccurrence = rows.find(item => item.id === selectedOccurrenceId)
  const manageWorkout = (occurrence, edit = false) => nav(`/studio/clients/${relationshipId}/workout?occurrence=${encodeURIComponent(occurrence.id)}${edit ? '&edit=1' : ''}`)
  const progress = () => nav(`/${mode === 'trainer' ? 'studio/clients' : 'coaching'}/${relationshipId}/progress`)
  const relevantOccurrences = [...visibleSchedule.upcoming.slice(0, 10), ...visibleSchedule.canceled.slice(0, 4), ...visibleSchedule.past.slice(0, 4)]
  return <CoachingShell mode={mode} title={workspace?.client?.name || 'Client workspace'} eyebrow={mode === 'trainer' ? 'Client workspace' : 'My workspace'} action={<Button onClick={() => nav(mode === 'trainer' ? '/studio' : '/coaching')}>Back</Button>}>
    {workspaceError && <section className="coaching-panel">
      <p className="coaching-error" role="alert">{workspaceError.message || 'Could not load the workspace.'}</p>
      {workspace && <p className="coaching-muted">Showing the last loaded workspace. Changes may not be up to date.</p>}
      <div className="coaching-actions"><Button disabled={refreshing} onClick={refreshWorkspace}>Try again</Button></div>
    </section>}
    {!workspace ? workspaceError ? null : (
      <section className="coaching-panel" style={{ display: 'grid', gap: 10 }}>
        <p role="status">Loading workspace…</p>
        <div aria-hidden="true" style={{ display: 'grid', gap: 10 }}>
          <Skeleton style={{ height: 14, width: '30%' }} />
          <Skeleton style={{ height: 20, width: '55%' }} />
          <Skeleton style={{ height: 12, width: '75%' }} />
        </div>
      </section>
    ) : <>
      {workspace.relationship.status === 'ended' && <div className="coaching-banner"><div><strong>Archived coaching</strong><p>This workspace is read-only. The client still owns these records.</p></div></div>}
      {workspace.relationship.status === 'active' && <TodayWorkoutCard key={`${accountId}:${relationshipId}`} workspace={workspace} mode={mode} onAssign={setAssignDate} onManage={manageWorkout} onProgress={progress} />}
      {mode === 'trainer' && workspace.relationship.status === 'active' && assignDate && <OneTimeWorkout key={`${accountId}:${relationshipId}:${assignDate}`} workspace={workspace} initialDate={assignDate} onPublished={refreshWorkspace} onClose={() => setAssignDate(null)} />}
      {selectedOccurrence && <WorkoutDetails occurrence={selectedOccurrence} timeZone={workspace.relationship.timeZone} today={dateInZone(new Date(), workspace.relationship.timeZone)} daySummary={selectedOccurrence.day} onClose={() => setSelectedOccurrenceId(null)} onEdit={mode === 'trainer' && workspace.relationship.status === 'active' ? () => manageWorkout(selectedOccurrence, true) : undefined} />}
      {workspace.relationship.status === 'ended' && workspace.workout && <section className="coaching-panel"><h2>Received workout prescription</h2>{workspace.workout.content.days.map(day => <div key={day.id}><h3>{day.name}</h3>{day.exercises.map(exercise => <p key={exercise.entryId}>{exercise.name}: {exercise.sets.map(set => exercise.mode === 'reps' ? `${set.weight || 0} ${workspace.workout.content.unit} × ${set.reps}` : exercise.mode === 'time' ? `${set.seconds} seconds` : `${set.minutes} minutes`).join(', ')}</p>)}</div>)}</section>}
      <div className="coaching-section-grid">
        <section className="coaching-panel"><h2>Workout plan</h2><p>{workspace.workout ? `${workspace.workout.content.name} · ${workspace.workout.content.days.length} training ${workspace.workout.content.days.length === 1 ? 'day' : 'days'}` : 'No recurring plan is assigned. One-time workouts appear in the schedule.'}</p><div className="coaching-actions">{mode === 'trainer' && workspace.relationship.status === 'active' && <><Button onClick={() => nav(`/studio/clients/${relationshipId}/workout`)}>{workspace.workout ? 'Edit recurring plan' : 'Assign recurring plan'}</Button><Button onClick={() => setAssignDate(dateInZone(new Date(), workspace.relationship.timeZone))}>Assign workout for a date</Button></>}</div>{startError && <p className="coaching-error" role="alert">{startError}</p>}</section>
        <section className="coaching-panel"><h2>Diet</h2><p>{workspace.diet ? `${workspace.diet.content.name} · updated ${new Date(workspace.diet.publishedAt).toLocaleDateString()}` : 'No diet has been assigned yet.'}</p><div className="coaching-actions">{mode==='trainer'?<Button onClick={()=>nav(`/studio/clients/${relationshipId}/diet`)}>{workspace.diet?'Edit diet':'Assign diet'}</Button>:workspace.diet?<Button onClick={()=>nav(`/coaching/${relationshipId}/diet`)}>View diet</Button>:null}</div></section>
        <section className="coaching-panel"><h2>Weekly check-in</h2><p>{workspace.checkIn ? `${workspace.checkIn.adherence} adherence${workspace.checkIn.needsReview?' · needs review':''}` : 'No check-in for this week.'}</p><Button onClick={()=>nav(`/${mode==='trainer'?'studio/clients':'coaching'}/${relationshipId}/check-in`)}>{mode==='trainer'?'Review check-in':'Open check-in'}</Button></section>
        <section className="coaching-panel"><h2>Fees</h2><p>{workspace.fees?.length ? `${workspace.fees.filter(x=>x.status==='unpaid').length} outstanding · ${workspace.fees.filter(x=>x.overdue).length} overdue` : 'No fees have been added.'}</p><Button onClick={()=>nav(`/${mode==='trainer'?'studio/clients':'coaching'}/${relationshipId}/fees`)}>{mode==='trainer'?'Manage fees':'View fees'}</Button></section>
      </div>
      {(workspace.workout || rows.length > 0) && <section className="coaching-panel"><h2>Schedule</h2><p>Upcoming workouts, days off and recent results. Dates use {workspace.relationship.timeZone}.</p><div className="coaching-schedule">{relevantOccurrences.length ? relevantOccurrences.map(item => <div key={item.id}><span>{new Date(item.scheduledDate + 'T12:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })}</span><button className="coaching-schedule-name" onClick={() => { setSelectedOccurrenceId(item.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{item.prescription?.dayName || 'Workout'}</button><small>{item.statusLabel || (item.state === 'canceled' ? 'Day off' : item.state === 'started' ? 'In progress' : item.state === 'completed' ? 'Completed' : item.scheduledDate < dateInZone(new Date(), workspace.relationship.timeZone) ? 'Missed' : 'Scheduled')}{item.oneTime ? ' · One-time' : ''}{item.customized ? ' · Customized' : ''}{item.overrideDate ? ` · Moved from ${item.originalDate}` : ''}</small></div>) : <p>No upcoming workouts are scheduled.</p>}</div></section>}
      <section className="coaching-panel"><h2>Progress</h2><p>Review scheduled sessions, completion, weight and sync status.</p><Button onClick={()=>nav(`/${mode==='trainer'?'studio/clients':'coaching'}/${relationshipId}/progress`)}>View progress</Button></section>
      <section className="coaching-panel"><h2>Personal history summary</h2><p>{workspace.personalSummary?.workouts || 0} workouts and {workspace.personalSummary?.weighIns || 0} weigh-ins are available to this workspace under the active consent.</p></section>
      <ContactClient key={`contact:${accountId}:${relationshipId}:${mode}`} workspace={workspace} mode={mode} />
      {mode === 'client' && <section className="coaching-panel"><h2>Contact trainer</h2><ContactTrainer number={workspace.trainer?.whatsAppNumber} /></section>}
      <div className="coaching-danger"><Button disabled={ending || workspace.relationship.status === 'ended'} onClick={end}>{ending ? 'Ending…' : 'End coaching'}</Button></div>
    </>}
  </CoachingShell>
}
