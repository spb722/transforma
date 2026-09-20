import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import Icon from '../../components/Icon.jsx'
import { Button, EmptyState, SkeletonRow } from '../../components/ui.jsx'

const feeLabel = totals => totals?.length ? totals.map(item => new Intl.NumberFormat(undefined, { style: 'currency', currency: item.currency }).format(item.amountMinor / 10 ** item.exponent)).join(' · ') : 'None'

export default function TrainerHome() {
  const nav = useNavigate()
  const { bootstrap, trainerOverview, loadBootstrap, loadTrainerOverview, startRevalidation, stopRevalidation } = useCoachingStore()
  const [search, setSearch] = useState('')
  useEffect(() => { Promise.all([loadBootstrap(), loadTrainerOverview()]).catch(() => {}); startRevalidation(loadTrainerOverview); return stopRevalidation }, [loadBootstrap, loadTrainerOverview, startRevalidation, stopRevalidation])
  const clients = useMemo(() => (trainerOverview?.items || []).filter(item => item.client.name.toLowerCase().includes(search.toLowerCase())), [trainerOverview, search])
  return <CoachingShell mode="trainer" title="Client overview" eyebrow="Trainer Studio" action={<Button variant="primary" icon="plus" onClick={() => nav('/studio/invitations')}>Invite client</Button>}>
    {!bootstrap?.trainerProfile && <div className="coaching-banner"><div><strong>Complete your studio profile</strong><p>Set your business name, time zone and optional WhatsApp number before inviting clients.</p></div><Button onClick={() => nav('/studio/settings')}>Set up</Button></div>}
    <div className="coaching-stat-grid">
      <article><span>Active clients</span><strong>{trainerOverview?.items?.length ?? '—'}</strong></article>
      <article><span>Sessions this week</span><strong>{(trainerOverview?.items || []).reduce((n, x) => n + x.weekly.completed, 0)}</strong></article>
      <article><span>Needs attention</span><strong>{(trainerOverview?.items || []).filter(x => x.checkInMissing || x.checkIn?.needsReview || x.fees?.some(f => f.overdue)).length}</strong></article>
    </div>
    <section className="coaching-panel"><h2>Outstanding fees</h2><p>{feeLabel(trainerOverview?.feeTotals)}</p></section>
    <section className="coaching-panel">
      <div className="coaching-panel-head"><div><h2>Your clients</h2><p>Assignments, activity and follow-ups in one place.</p></div><label className="coaching-search"><Icon name="magnifier" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients" /></label></div>
      {!trainerOverview ? (
        // Loading and "no clients yet" used to render identically (FR-026).
        <div className="coaching-client-list"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
      ) : clients.length === 0 ? (
        <EmptyState icon="person" title={search ? 'No matching clients' : 'No clients yet'} description={search ? 'Try a different name.' : 'Create a secure invitation when you are ready.'} />
      ) : <div className="coaching-client-list">
        {clients.map(item => <button key={item.relationship.id} onClick={() => nav(`/studio/clients/${item.relationship.id}`)}>
          <span className="coaching-avatar">{item.client.name.slice(0, 1).toUpperCase()}</span><span><strong>{item.client.name}</strong><small>{item.weekly.completed} of {item.weekly.scheduled} sessions · {item.checkInMissing ? 'check-in missing' : item.checkIn?.needsReview ? 'check-in changed' : 'check-in received'} · {feeLabel(item.feeTotals)} due</small></span><Icon name="chevronRight" />
        </button>)}
      </div>}
    </section>
  </CoachingShell>
}
