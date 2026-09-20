import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import { Button, EmptyState, Skeleton } from '../../components/ui.jsx'

export default function ClientHome() {
  const nav = useNavigate()
  const { bootstrap, ownWorkspace, loadBootstrap, loadOwnWorkspace, startRevalidation, stopRevalidation } = useCoachingStore()
  useEffect(() => { loadBootstrap().catch(() => {}); startRevalidation(loadBootstrap); return stopRevalidation }, [loadBootstrap, startRevalidation, stopRevalidation])
  const active = bootstrap?.relationships?.find(x => x.status === 'active')
  useEffect(() => { if (active) loadOwnWorkspace(active.id).catch(() => {}) }, [active?.id, loadOwnWorkspace])
  return <CoachingShell mode="client" title="Your coaching" eyebrow="Today">
    {!bootstrap ? (
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
      <section className="coaching-hero"><div><span>Active coaching</span><h2>{ownWorkspace?.workout?.content?.name || 'Your plan and progress are ready'}</h2><p>Open your workspace for assigned workouts, diet, check-ins, progress and fees.</p></div><Button variant="primary" onClick={() => nav(`/coaching/${active.id}`)}>Open workspace</Button></section>
      <div className="coaching-stat-grid"><article><span>Relationship</span><strong>Active</strong></article><article><span>Outstanding fees</span><strong>{ownWorkspace?.fees?.filter(item=>item.status==='unpaid').length || 0}</strong></article><article><span>Time zone</span><strong className="coaching-small-value">{active.timeZone}</strong></article></div>
    </>}
  </CoachingShell>
}
