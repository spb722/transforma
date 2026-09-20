import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import { coachingMutation } from '../../lib/coaching/api.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import ContactTrainer from '../../components/coaching/ContactTrainer.jsx'
import { Button, Skeleton } from '../../components/ui.jsx'
import { beginAssignedWorkout, confirmSheet } from '../../sheets.jsx'
import { ownAssignmentSchedule } from '../../lib/coaching/schedule.js'

export default function ClientWorkspace({ mode }) {
  const { relationshipId } = useParams()
  const nav = useNavigate()
  const store = useCoachingStore()
  const workspace = mode === 'trainer' ? store.trainerWorkspace : store.ownWorkspace
  const [ending, setEnding] = useState(false)
  const [startError, setStartError] = useState('')
  const load = mode === 'trainer' ? store.loadTrainerWorkspace : store.loadOwnWorkspace
  useEffect(() => { load(relationshipId).catch(() => {}) }, [load, relationshipId])
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
      } finally { setEnding(false) }
    }
  })
  const visibleSchedule = workspace ? ownAssignmentSchedule(workspace) : { upcoming: [], canceled: [], past: [] }
  const todayOccurrence = visibleSchedule.today
  const relevantOccurrences = [...visibleSchedule.upcoming.slice(0, 10), ...visibleSchedule.canceled.slice(0, 4), ...visibleSchedule.past.slice(0, 4)]
  return <CoachingShell mode={mode} title={workspace?.client?.name || 'Client workspace'} eyebrow={mode === 'trainer' ? 'Client workspace' : 'My workspace'} action={<Button onClick={() => nav(mode === 'trainer' ? '/studio' : '/coaching')}>Back</Button>}>
    {!workspace ? (
      <section className="coaching-panel" style={{ display: 'grid', gap: 10 }}>
        <Skeleton style={{ height: 14, width: '30%' }} />
        <Skeleton style={{ height: 20, width: '55%' }} />
        <Skeleton style={{ height: 12, width: '75%' }} />
      </section>
    ) : <>
      {workspace.relationship.status === 'ended' && <div className="coaching-banner"><div><strong>Archived coaching</strong><p>This workspace is read-only. The client still owns these records.</p></div></div>}
      <div className="coaching-section-grid">
        <section className="coaching-panel"><h2>Workout plan</h2><p>{workspace.workout ? `${workspace.workout.content.name} · ${workspace.workout.content.days.length} training days` : 'No workout has been assigned yet.'}</p><div className="coaching-actions">{mode === 'trainer' ? <Button onClick={() => nav(`/studio/clients/${relationshipId}/workout`)}>{workspace.workout ? 'Edit plan' : 'Assign plan'}</Button> : todayOccurrence ? <Button variant="primary" onClick={async () => { setStartError(''); try { await beginAssignedWorkout(todayOccurrence) } catch (error) { setStartError(error.message) } }}>{todayOccurrence.state === 'started' ? 'Resume today’s workout' : 'Start today’s workout'}</Button> : null}</div>{startError && <p className="coaching-error" role="alert">{startError}</p>}</section>
        <section className="coaching-panel"><h2>Diet</h2><p>{workspace.diet ? `${workspace.diet.content.name} · updated ${new Date(workspace.diet.publishedAt).toLocaleDateString()}` : 'No diet has been assigned yet.'}</p><div className="coaching-actions">{mode==='trainer'?<Button onClick={()=>nav(`/studio/clients/${relationshipId}/diet`)}>{workspace.diet?'Edit diet':'Assign diet'}</Button>:workspace.diet?<Button onClick={()=>nav(`/coaching/${relationshipId}/diet`)}>View diet</Button>:null}</div></section>
        <section className="coaching-panel"><h2>Weekly check-in</h2><p>{workspace.checkIn ? `${workspace.checkIn.adherence} adherence${workspace.checkIn.needsReview?' · needs review':''}` : 'No check-in for this week.'}</p><Button onClick={()=>nav(`/${mode==='trainer'?'studio/clients':'coaching'}/${relationshipId}/check-in`)}>{mode==='trainer'?'Review check-in':'Open check-in'}</Button></section>
        <section className="coaching-panel"><h2>Fees</h2><p>{workspace.fees?.length ? `${workspace.fees.filter(x=>x.status==='unpaid').length} outstanding · ${workspace.fees.filter(x=>x.overdue).length} overdue` : 'No fees have been added.'}</p><Button onClick={()=>nav(`/${mode==='trainer'?'studio/clients':'coaching'}/${relationshipId}/fees`)}>{mode==='trainer'?'Manage fees':'View fees'}</Button></section>
      </div>
      {workspace.workout && <section className="coaching-panel"><h2>Schedule</h2><p>Upcoming sessions are shown first, followed by days off and recent history.</p><div className="coaching-schedule">{relevantOccurrences.map(item=><div key={item.id}><span>{new Date(item.scheduledDate+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</span><strong>{item.state === 'canceled' && item.cancellationReason === 'explicit' ? 'Day off' : item.prescription.dayName}</strong><small>{item.state === 'canceled' && item.cancellationReason === 'explicit' ? 'given by trainer' : item.state === 'canceled' ? 'removed by plan' : item.state}{item.customized ? ' · customized' : ''}{item.overrideDate ? ` · moved from ${item.originalDate}` : ''}</small></div>)}</div></section>}
      <section className="coaching-panel"><h2>Progress</h2><p>Review scheduled sessions, completion, weight and sync status.</p><Button onClick={()=>nav(`/${mode==='trainer'?'studio/clients':'coaching'}/${relationshipId}/progress`)}>View progress</Button></section>
      <section className="coaching-panel"><h2>Personal history summary</h2><p>{workspace.personalSummary.workouts} workouts and {workspace.personalSummary.weighIns} weigh-ins are available to this workspace under the active consent.</p></section>
      {mode === 'client' && <section className="coaching-panel"><h2>Contact trainer</h2><ContactTrainer number={workspace.trainer?.whatsAppNumber} /></section>}
      <div className="coaching-danger"><Button disabled={ending || workspace.relationship.status === 'ended'} onClick={end}>{ending ? 'Ending…' : 'End coaching'}</Button></div>
    </>}
  </CoachingShell>
}
