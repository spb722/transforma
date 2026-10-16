import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import TodayWorkoutCard from '../../components/coaching/TodayWorkoutCard.jsx'
import { Button, EmptyState, Skeleton } from '../../components/ui.jsx'

export default function ClientHome() {
  const nav = useNavigate()
  const { userId, bootstrap, ownWorkspace, error, loading, loadBootstrap, loadOwnWorkspace, startRevalidation, stopRevalidation } = useCoachingStore()
  const [failure, setFailure] = useState(null)
  const refreshHome = useCallback(async () => {
    try {
      const fresh = await loadBootstrap()
      if (useCoachingStore.getState().userId !== userId) return
      const relationship = fresh?.relationships?.find(item => item.status === 'active')
      if (relationship) await loadOwnWorkspace(relationship.id)
      if (useCoachingStore.getState().userId === userId) setFailure(null)
    } catch (error) {
      if (useCoachingStore.getState().userId === userId) setFailure({ userId, error })
    }
  }, [loadBootstrap, loadOwnWorkspace, userId])
  // Workspace refreshes share the store error field. Keep this screen's failed
  // bootstrap visible until its own retry succeeds.
  const homeError = (failure?.userId === userId ? failure.error : null) || error
  useEffect(() => { refreshHome(); startRevalidation(refreshHome); return stopRevalidation }, [refreshHome, startRevalidation, stopRevalidation])
  const active = bootstrap?.relationships?.find(x => x.status === 'active')
  const activeWorkspace = ownWorkspace?.relationship?.id === active?.id && ownWorkspace?.relationship?.status === 'active' ? ownWorkspace : null
  const archived = bootstrap?.relationships?.filter(x => x.status === 'ended') || []

  return <CoachingShell mode="client" title="Your coaching" eyebrow="Today">
    {homeError && <section className="coaching-panel">
      <p className="coaching-error" role="alert">{homeError.message}</p>
      {bootstrap && <p className="coaching-muted">Showing the last loaded coaching information.</p>}
      <Button disabled={loading} onClick={refreshHome}>Try again</Button>
    </section>}
    {!bootstrap ? homeError ? null : (
      // Loading and "no trainer yet" used to share one .coaching-empty treatment,
      // making a slow request look identical to a real empty state (FR-026).
      <section className="coaching-hero">
        <div style={{ width: '100%', display: 'grid', gap: 10 }}>
          <Skeleton style={{ height: 12, width: '35%' }} />
          <Skeleton style={{ height: 22, width: '65%' }} />
          <Skeleton style={{ height: 12, width: '85%' }} />
        </div>
      </section>
    ) : !active ? (
      <EmptyState
        className="coaching-panel"
        icon="personCircle"
        title="No active trainer"
        description="Open an invitation link from your trainer to connect. Your personal workouts remain available."
        action={<Button onClick={() => nav('/home')}>Open personal workouts</Button>}
      />
    ) : <>
      {activeWorkspace ? <TodayWorkoutCard key={`${userId}:${active.id}`} workspace={activeWorkspace} onProgress={() => nav(`/coaching/${active.id}/progress`)} /> : <section className="coaching-panel"><p role="status">{homeError ? 'Today’s workout is unavailable. Try loading your coaching again.' : 'Loading today’s workout…'}</p>{!homeError && <Skeleton style={{ height: 24, width: '65%' }} />}</section>}
      <section className="coaching-hero"><div><span>Active coaching</span><h2>{activeWorkspace?.workout?.content?.name || 'Your plan and progress are ready'}</h2><p>Open your workspace for assigned workouts, diet, check-ins, progress and fees.</p></div><Button variant="primary" onClick={() => nav(`/coaching/${active.id}`)}>Open workspace</Button></section>
      <div className="coaching-stat-grid"><article><span>Relationship</span><strong>Active</strong></article><article><span>Outstanding fees</span><strong>{activeWorkspace ? activeWorkspace.fees?.filter(item=>item.status==='unpaid').length || 0 : '—'}</strong></article><article><span>Time zone</span><strong className="coaching-small-value">{active.timeZone}</strong></article></div>
    </>}
    {archived.length > 0 && <section className="coaching-panel"><h2>Archived coaching</h2><p>Your received plans, check-ins and fees remain available after coaching ends.</p>{archived.map(relationship => <div className="coaching-actions" key={relationship.id}><span>Ended {new Date(relationship.endedAt).toLocaleDateString()}</span><Button onClick={() => nav(`/coaching/${relationship.id}`)}>Open archived workspace</Button></div>)}</section>}
  </CoachingShell>
}
