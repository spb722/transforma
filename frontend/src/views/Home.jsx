import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor } from '../sheets.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button, EmptyState, ScreenHeader } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'
import { coachAvailable, hasConsent } from '../lib/coach.js'
import { useCoachStatus } from '../lib/coach-api.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { useCoachingStore } from '../store/useCoachingStore.js'
import { hasActiveCoachPlan, occurrenceOnDate, ownAssignmentSchedule } from '../lib/coaching/schedule.js'
import { beginAssignedWorkout } from '../sheets.jsx'
import { useUI } from '../store/useUI.js'

function shiftIso(value, amount) {
  const date = new Date(`${value}T12:00:00`)
  date.setDate(date.getDate() + amount)
  return isoOf(date)
}

// A job in flight or a proposal waiting is the only reason the Coach interrupts Home. When it
// has nothing to say it renders nothing at all — and it only polls while Home is on screen.
function CoachCard({ nav }) {
  const S = useStore(s => s.S)
  const { job, pending } = useCoachStatus(hasConsent(S))
  if (!hasConsent(S) || (!job && !pending)) return null
  const ready = !!pending
  return <div className="card" style={ready ? { borderColor: 'var(--acc)' } : null}>
    <div className="today-row" onClick={() => nav(ready ? '/coach/proposal' : '/coach')}>
      <div className="row" style={{ gap: 9, minWidth: 0 }}>
        <span className="lrow-i" style={{ background: ready ? 'var(--acc)' : 'var(--orange)' }}><Icon name="sparkles" /></span>
        <div style={{ minWidth: 0 }}>
          <div className="lbl2">{t('Coach')}</div>
          <div className="ttl">{ready
            ? (pending.kind === 'create'
              ? t('Your plan is ready')
              : t(pending.changes?.length === 1 ? '{0} suggestion for you' : '{0} suggestions for you', pending.changes?.length || 0))
            : t('Reading your training…')}</div>
        </div>
      </div>
      {ready ? <span className="tag acc">{t('Review')}</span> : <Icon name="chevronRight" className="chev" />}
    </div>
  </div>
}

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const ownWorkspace = useCoachingStore(s => s.ownWorkspace)
  const [weekOffset, setWeekOffset] = useState(0)
  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })
  const assigned = ownAssignmentSchedule(ownWorkspace)
  const coachPlanActive = hasActiveCoachPlan(ownWorkspace)
  const [selectedCoachDate, setSelectedCoachDate] = useState(null)
  const coachDate = selectedCoachDate || assigned.relationshipDate || todayISO()
  const selectedOccurrence = coachPlanActive ? occurrenceOnDate(ownWorkspace, coachDate) : null
  const selectedIsToday = coachDate === assigned.relationshipDate

  const today = new Date()
  const routine = coachPlanActive ? null : effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    const routineHere = eff ? S.routines.find(r => r.id === eff) : null
    const coachOccurrence = coachPlanActive ? occurrenceOnDate(ownWorkspace, iso) : null
    const dot = done || coachOccurrence?.state === 'completed' ? ' done' : ['scheduled', 'started'].includes(coachOccurrence?.state) ? ' plan' : coachOccurrence?.state === 'canceled' ? ' ovr' : !coachPlanActive && ovr && eff ? ' ovr' : !coachPlanActive && eff ? ' plan' : ''
    // Same facts the dot colour above already encodes, spelled out as a short word
    // instead — the 2a direction reads a day's plan as text, not just a coloured mark.
    const label = coachOccurrence
      ? (coachOccurrence.state === 'canceled' ? t('Off') : (coachOccurrence.prescription?.dayName || t('Assigned')).split(' ')[0])
      : ovr && !eff ? t('Off')
        : routineHere ? routineHere.name.split(' ')[0]
          : '—'
    strip.push(<button key={i} className={'daycell' + (iso === todayISO() ? ' today' : '') + (coachPlanActive && iso === coachDate ? ' selected' : '') + (dot ? ' has-' + dot.trim() : '')} onClick={coachPlanActive ? () => setSelectedCoachDate(iso) : () => dayOverrideSheet(iso)}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className="daylabel">{label}</div></button>)
  }
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = coachPlanActive
    ? new Set(ownWorkspace.workout.content.days.flatMap(day => day.weekdays || [])).size
    : Object.keys(S.week).filter(k => S.week[k]).length
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  const moveWeek = amount => {
    setWeekOffset(value => value + amount)
    if (coachPlanActive) setSelectedCoachDate(value => shiftIso(value || assigned.relationshipDate || todayISO(), amount * 7))
  }

  // In coached mode the card follows the selected calendar date. Only today's row can start.
  const onPrimary = async () => {
    if (S.active) { nav('/workout'); return }
    if (coachPlanActive) {
      if (selectedIsToday && selectedOccurrence && ['scheduled', 'started'].includes(selectedOccurrence.state)) {
        try { await beginAssignedWorkout(selectedOccurrence) } catch (error) { useUI.getState().toast(error.message || 'Reconnect and try again') }
      } else if (selectedOccurrence) nav('/plan')
      return
    }
    if (routine) startFlow(routine.id); else dayOverrideSheet(todayISO())
  }

  const coachTitle = selectedOccurrence?.state === 'canceled' ? t('Day off') : selectedOccurrence?.prescription?.dayName || t('No coach workout scheduled')
  const coachStateLabel = selectedOccurrence?.state === 'started' ? t('In progress')
    : selectedOccurrence?.state === 'completed' ? t('Completed')
      : selectedOccurrence?.state === 'canceled' ? t('Given by your trainer')
        : selectedOccurrence?.customized && selectedOccurrence?.overrideDate ? t('Customized · Rescheduled')
          : selectedOccurrence?.customized ? t('Customized')
            : selectedOccurrence?.overrideDate ? t('Rescheduled')
              : selectedOccurrence?.state === 'scheduled' ? t('Coach assigned') : null

  // Trainer-authored days get the full-bleed green block (research.md §1a: green is
  // reserved for the primary action and for anything the trainer authored); a
  // self-directed day is plain surface, with the primary action itself carrying green.
  const primaryLabel = S.active ? t('Resume')
    : coachPlanActive && selectedIsToday && selectedOccurrence?.state === 'started' ? t('Resume')
      : coachPlanActive && selectedIsToday && selectedOccurrence?.state === 'scheduled' ? t('Start workout')
        : coachPlanActive && selectedOccurrence ? t('View coach schedule')
          : coachPlanActive ? null
            : routine ? t('Start') : null
  const todayTitle = S.active ? t('{0} — in progress', S.active.name) : coachPlanActive ? coachTitle : routine ? routine.name : t('Rest day')
  const todayMeta = coachPlanActive && coachStateLabel ? ' · ' + coachStateLabel : todayOvr && routine ? ' · ' + t('rescheduled') : ''

  return <div className="narrow">
    <ScreenHeader
      title={user ? t('Hi {0}', user.name) : 'transforma'}
      subtitle={today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}
      onDeviceLabel={t('On device')}
      action={<button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>}
    />

    {coachPlanActive ? (
      <div className="trainer-block" style={{ marginTop: 22 }}>
        <div className="eyebrow"><Icon name="personCircle" />{selectedIsToday ? t('Today · given by your trainer') : fmtDate(coachDate, true)}</div>
        <h2>{todayTitle}{todayMeta}</h2>
        {selectedOccurrence && <div className="meta">{selectedOccurrence.scheduledDate} · {ownWorkspace.relationship.timeZone}</div>}
        {primaryLabel && (
          <button className="trainer-cta" onClick={onPrimary}>
            <span>{primaryLabel}</span><Icon name="arrowRight" />
          </button>
        )}
      </div>
    ) : (
      // The whole block stays tappable (not just the accessory) — a rest day with
      // nothing to start still opens the day-override sheet via onPrimary, same as
      // before this restyle.
      <button className="bcell" style={{ marginTop: 18, width: '100%', textAlign: 'left' }} onClick={onPrimary}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow"><Icon name={S.active ? 'timer' : routine ? glyphOf(routine.emoji) : 'moon'} />{t('Today')}</div>
            <h2 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', margin: '6px 0 0' }}>{todayTitle}{todayMeta}</h2>
          </div>
          {primaryLabel ? <span className="tag acc" style={{ flex: 'none' }}>{primaryLabel}</span> : <Icon name="plus" className="chev" />}
        </div>
      </button>
    )}

    <div className="row between" style={{ margin: '22px 0 10px' }}>
      <button className="eyebrow" style={{ minHeight: 32 }} onClick={() => moveWeek(-1)} aria-label="Previous week"><Icon name="chevronLeft" />{t('Prev')}</button>
      <div className="eyebrow" style={{ color: 'var(--label)' }}>{wkLabel}</div>
      <button className="eyebrow" style={{ minHeight: 32 }} onClick={() => moveWeek(1)} aria-label="Next week">{t('Next')}<Icon name="chevronRight" /></button>
    </div>
    <div className="bgrid bgrid-7">{strip}</div>

    {coachOn && !coachPlanActive && <CoachCard nav={nav} />}

    {!coachPlanActive && !S.routines.length && !S.active && (
      <EmptyState
        className="card"
        icon="sparkles"
        title={t('Welcome!')}
        description={t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}
        action={
          <div style={{ width: '100%', display: 'grid', gap: 8, marginTop: 6 }}>
            {coachOn && <Button variant="primary" icon="sparkles" onClick={() => nav(hasConsent(S) ? '/coach/intake' : '/coach')}>{t('Let the Coach build it')}</Button>}
            <Button variant={coachOn ? 'plain' : 'primary'} icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (PPL)')}</Button>
            <Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
          </div>
        }
      />
    )}

    <div className="bgrid bgrid-2" style={{ marginTop: 22 }}>
      <div className="bcell">
        <div className="eyebrow"><Icon name="flame" />{t('Week streak')}</div>
        <div className="big">{streakWeeks(S)}</div>
        <div className="sub">{wThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')}</div>
      </div>
      <button className="bcell" style={{ textAlign: 'left' }} onClick={() => calendarSheet()}>
        <div className="eyebrow"><Icon name="dumbbell" />{t('Workouts')}</div>
        <div className="big">{S.workouts.length}</div>
        <div className="sub">{t('total · view calendar')}</div>
      </button>
    </div>

    <div className="bcell" style={{ marginTop: 2 }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 className="eyebrow"><Icon name="scale" />{t('Body weight')}</h2>
        <div className="row" style={{ gap: 16 }}>
          <button className="tag acc" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</button>
          <button className="tag acc" onClick={() => bwSheet()}><Icon name="plus" />{t('Log')}</button>
        </div>
      </div>
      {bw ? <>
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <div className="big">{fmtNum(bw.w)} <span className="unit">{S.unit}</span></div>
          {/* only when it actually moved — an unchanged weight used to read as "− 0" */}
          {!!delta && (
            <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
              {fmtNum(Math.abs(delta))}
            </span>
          )}
          <span className="dim small" style={{ marginLeft: 'auto' }}>{fmtDate(bw.d, true)}</span>
        </div>
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
      </> : <div style={{ marginTop: 2, fontSize: 14, color: 'var(--label-2)' }}>{t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}</div>}
    </div>
  </div>
}
