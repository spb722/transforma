import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoachingStore } from '../../store/useCoachingStore.js'
import CoachingShell from '../../components/coaching/CoachingShell.jsx'
import Icon from '../../components/Icon.jsx'
import { Button, EmptyState, SkeletonRow } from '../../components/ui.jsx'
import './trainer-today.css'

const feeLabel = totals => totals?.length ? totals.map(item => new Intl.NumberFormat(undefined, { style: 'currency', currency: item.currency }).format(item.amountMinor / 10 ** item.exponent)).join(' · ') : 'None'
const checkInLabel = item => item.checkInMissing ? 'check-in missing' : item.checkIn?.needsReview ? (item.checkIn.response ? 'check-in changed, needs review' : 'check-in needs review') : 'check-in reviewed'
const needsAttention = item => item.missedWorkouts?.length > 0 || item.weekly.partial > 0 || item.weekly.zero > 0 || item.today?.state === 'abandoned' || item.checkInMissing || item.checkIn?.needsReview || item.fees?.some(f => f.overdue) || item.feedbackNeedsAttention
const trainingToday = item => item.today && !['day_off', 'no_workout'].includes(item.today.state)
const dayLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
const timeLabel = (value, timeZone) => new Date(value).toLocaleTimeString(undefined, { timeZone, hour: 'numeric', minute: '2-digit' })
const emptyDayLabel = today => today?.reason === 'planned_rest_day' ? 'Planned rest day' : today?.reason === 'no_plan' ? 'No assigned plan' : 'No workout scheduled'

export default function TrainerHome() {
  const nav = useNavigate()
  const { userId, bootstrap, trainerOverview, loadBootstrap, loadTrainerOverview, startRevalidation, stopRevalidation } = useCoachingStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [retry, setRetry] = useState(0)
  const [overviewState, setOverviewState] = useState(() => ({ userId, data: trainerOverview, loading: true, error: '', profileError: '' }))
  useEffect(() => {
    let active = true
    let sequence = 0
    const current = () => active && useCoachingStore.getState().userId === userId
    setOverviewState(previous => ({ userId, data: previous.userId === userId ? previous.data : null, loading: true, error: '', profileError: '' }))
    loadBootstrap().catch(error => {
      if (current()) setOverviewState(previous => ({ ...previous, profileError: error.message, data: [401, 403, 404].includes(error.status) ? null : previous.data }))
    })
    const refresh = async () => {
      const request = ++sequence
      setOverviewState(previous => ({ ...previous, loading: true }))
      try {
        const data = await loadTrainerOverview()
        if (current() && request === sequence) setOverviewState(previous => ({ ...previous, data: data || previous.data, loading: false, error: '' }))
      } catch (error) {
        if (current() && request === sequence) setOverviewState(previous => ({
          ...previous, loading: false, error: error.message,
          // Keep the last successful view through a connection failure only.
          data: [401, 403, 404].includes(error.status) ? null : previous.data
        }))
      }
    }
    refresh()
    startRevalidation(refresh)
    return () => { active = false; stopRevalidation() }
  }, [userId, retry, loadBootstrap, loadTrainerOverview, startRevalidation, stopRevalidation])
  const state = overviewState.userId === userId ? overviewState : null
  const overview = state?.data
  const error = state?.error || state?.profileError
  const allClients = overview?.items || []
  const clients = useMemo(() => (overview?.items || []).filter(item => item.client.name.toLowerCase().includes(search.trim().toLowerCase()) && (filter === 'all' || (filter === 'training' ? trainingToday(item) : needsAttention(item)))), [overview, search, filter])
  const filters = [
    { id: 'all', label: 'All clients', count: allClients.length },
    { id: 'training', label: 'Training today', count: allClients.filter(trainingToday).length },
    { id: 'attention', label: 'Needs attention', count: allClients.filter(needsAttention).length }
  ]
  return <CoachingShell mode="trainer" title="Client overview" eyebrow="Trainer Studio" action={<Button variant="primary" icon="plus" onClick={() => nav('/studio/invitations')}>Invite client</Button>}>
    {error && <div className="coaching-error" role="alert"><p>{error}</p>{overview && <p>Showing the last loaded overview. It may be out of date.</p>}<div className="coaching-actions"><Button disabled={state.loading} onClick={() => setRetry(value => value + 1)}>Try again</Button></div></div>}
    {bootstrap && !bootstrap.trainerProfile && <div className="coaching-banner"><div><strong>Complete your studio profile</strong><p>Set your business name, time zone and optional WhatsApp number before inviting clients.</p></div><Button onClick={() => nav('/studio/settings')}>Set up</Button></div>}
    <div className="coaching-stat-grid">
      <article><span>Active clients</span><strong>{overview?.items?.length ?? '—'}</strong></article>
      <article><span>Training today</span><strong>{overview ? allClients.filter(trainingToday).length : '—'}</strong></article>
      <article><span>Needs attention</span><strong>{overview ? allClients.filter(needsAttention).length : '—'}</strong></article>
    </div>
    <section className="coaching-panel">
      <div className="coaching-panel-head"><div><h2>Today</h2><p>Each client’s day uses their coaching time zone. Open a client to view or assign a workout.</p></div><label className="coaching-search"><Icon name="magnifier" /><input aria-label="Search clients" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients" /></label></div>
      <div className="trainer-today-filters" role="group" aria-label="Filter clients">{filters.map(option => <button key={option.id} type="button" aria-pressed={filter === option.id} onClick={() => setFilter(option.id)}>{option.label}<span>{overview ? option.count : '—'}</span></button>)}</div>
      {!overview ? (
        state?.loading ? <div className="coaching-client-list" role="status" aria-label="Loading clients"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div> : <p>Client data is unavailable.</p>
      ) : clients.length === 0 ? (
        <EmptyState icon="person" title={!allClients.length ? 'No clients yet' : search ? 'No matching clients' : filter === 'training' ? 'No workouts today' : 'Nothing needs attention'} description={!allClients.length ? 'Create a secure invitation when you are ready.' : search ? 'Try a different name or filter.' : filter === 'training' ? 'Choose All clients to assign a workout or view a rest day.' : 'You’re up to date with your clients.'} />
      ) : <div className="coaching-client-list">
        {clients.map(item => <button className="trainer-today-row" key={item.relationship.id} onClick={() => nav(`/studio/clients/${item.relationship.id}`)} aria-label={`Open ${item.client.name}’s day: ${item.today?.label || 'No workout'}`}>
          <span className="coaching-avatar" aria-hidden="true">{item.client.name.slice(0, 1).toUpperCase()}</span>
          <span className="trainer-today-client">
            <span className="trainer-today-heading"><strong>{item.client.name}</strong><span className={`trainer-today-status trainer-today-status-${item.today?.state || 'no_workout'}`}>{item.today?.label || 'No workout'}</span></span>
            <span className="trainer-today-workout">{item.today?.workoutName || emptyDayLabel(item.today)}</span>
            {item.today && <small>{dayLabel(item.today.date)} · {item.today.timeZone}{item.today.startedAt ? ` · Started ${timeLabel(item.today.startedAt, item.today.timeZone)}` : ''}{item.today.finishedAt ? ` · Finished ${timeLabel(item.today.finishedAt, item.today.timeZone)}` : ''}</small>}
            {item.missedWorkouts?.length > 0 && <span className="trainer-today-attention">Missed {dayLabel(item.missedWorkouts[0].date)}: {item.missedWorkouts[0].workoutName}{item.missedWorkouts.length > 1 ? ` · ${item.missedWorkouts.length - 1} more missed` : ''}</span>}
            {item.feedbackNeedsAttention && <span className="trainer-today-attention">Workout feedback needs review</span>}
            <small>{item.weekly.completed} of {item.weekly.scheduled} this week{item.weekly.partial > 0 ? ` · ${item.weekly.partial} partial` : ''}{item.weekly.zero > 0 ? ` · ${item.weekly.zero} finished with no sets` : ''} · {checkInLabel(item)}{item.fees?.some(f => f.overdue) ? ' · fee overdue' : ''}</small>
          </span>
          <Icon name="chevronRight" />
        </button>)}
      </div>}
    </section>
    <section className="coaching-panel"><h2>Outstanding fees</h2><p>{overview ? feeLabel(overview.feeTotals) : state?.loading ? 'Loading fees…' : 'Fees unavailable.'}</p></section>
  </CoachingShell>
}
