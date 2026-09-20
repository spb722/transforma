import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, StatusBadge, EmptyState, ScreenHeader } from '../components/ui.jsx'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
import { coachAvailable } from '../lib/coach.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { useCoachingStore } from '../store/useCoachingStore.js'
import { hasActiveCoachPlan, ownAssignmentSchedule } from '../lib/coaching/schedule.js'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const config = useStore(s => s.config)
  const update = useStore(s => s.update)
  const coachOn = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE })
  const ownWorkspace = useCoachingStore(s => s.ownWorkspace)
  const assigned = ownAssignmentSchedule(ownWorkspace)
  const coachPlanActive = hasActiveCoachPlan(ownWorkspace)

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  return <div className="narrow">
    <ScreenHeader
      title={t('Plan')}
      subtitle={coachPlanActive ? t('Your coach-assigned schedule') : t('Your weekly routine')}
      onDeviceLabel={t('On device')}
      action={<div className="row" style={{ gap: 14 }}>
        {!coachPlanActive && coachOn && <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={() => nav('/coach')} aria-label={t('Coach')} title={t('Coach')}><Icon name="sparkles" /></button>}
        {!coachPlanActive && <button className="iconbtn" style={{ width: 32, height: 32 }} onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>}
      </div>}
    />
    {coachPlanActive ? <CoachAssignedPlan workspace={ownWorkspace} assigned={assigned} /> : <>
      <h4 className="eyebrow" style={{ margin: '22px 0 2px' }}>{t('Week schedule')}</h4>
      <div className="blocklist">
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const r = S.routines.find(x => x.id === S.week[d])
          return <button key={d} className="row between" style={{ width: '100%', textAlign: 'left' }} onClick={() => dayAssignSheet(d)}>
            <div className="grow" style={{ fontSize: 15, fontWeight: 600 }}>{t(DAYN[d])}</div>
            {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
            <Icon name="chevronRight" className="chev" /></button>
        })}
      </div>

      <div className="row between" style={{ marginTop: 22, marginBottom: 2 }}>
        <h4 className="eyebrow">{t('Routines')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
      </div>
      {S.routines.length ? <div className="blocklist">{S.routines.map(r => <button key={r.id} className="row between" style={{ width: '100%', textAlign: 'left' }} onClick={() => nav('/plan/r/' + r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <Icon name="chevronRight" className="chev" /></button>)}</div> : (
        <EmptyState
          className="bcell"
          icon="clipboard"
          title={t('No routines yet.')}
          description={t('Create one or load the starter plan.')}
          action={<Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>}
        />
      )}
    </>}
  </div>
}

function CoachAssignedPlan({ workspace, assigned }) {
  const plan = workspace.workout.content
  return <>
    {/* Trainer-authored content carries the dedicated trainer-authority eyebrow
        colour, not the client's personal accent — the signal must read the same
        regardless of which of the 8 accent colors this client has chosen
        (FR-007, contracts/ui-component-contract.md §1). */}
    <div className="bcell" style={{ marginTop: 18 }}>
      <div className="row between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div className="eyebrow eyebrow-trainer"><Icon name="personCircle" />{t('Coach-assigned plan')}</div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', marginTop: 2 }}>{plan.name}</div>
          <div style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 4 }}>{t('Your trainer manages this plan and its schedule.')}</div>
        </div>
        <StatusBadge status="read-only" label={t('Read only')} />
      </div>
    </div>

    <h4 className="eyebrow" style={{ margin: '22px 0 2px' }}>{t('Training plan')}</h4>
    {plan.days.map((day, i) => {
      // "All sets rest Xs" only if every timed/reps exercise in the day actually
      // agrees on X — a real plan's rest periods vary far more than the design's
      // single-example mockup, so a wrong specific number would be worse than
      // dropping it.
      const restValues = new Set(day.exercises.map(e => e.restSec).filter(v => v != null))
      const restNote = restValues.size === 1 ? t('All sets rest {0}s · targets are your trainer\'s.', [...restValues][0]) : t("Targets are your trainer's.")
      const nextDay = plan.days[i + 1]
      return <div key={day.id} style={{ marginBottom: 2 }}>
        <div className="row between" style={{ alignItems: 'baseline', marginTop: 20, paddingBottom: 8, borderBottom: '2px solid var(--label)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.01em' }}>{day.name}</div>
          <div className="eyebrow" style={{ fontSize: 11 }}>{(day.weekdays || []).map(coachWeekday).join(' · ')}</div>
        </div>
        <div className="blocklist" style={{ marginTop: 2 }}>{day.exercises.map(exercise => <div className="row between" key={exercise.entryId || exercise.id}>
          <div className="grow" style={{ fontSize: 15, fontWeight: 600 }}>
            {exercise.name}
            {exercise.notes && <div style={{ fontSize: 13, color: 'var(--label-2)', marginTop: 2, fontWeight: 400 }}>{exercise.notes}</div>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{coachExerciseLine(exercise, plan.unit)}</div>
        </div>)}</div>
        <div className="row between" style={{ gap: 12, fontSize: 12, color: 'var(--label-3)', marginTop: 6 }}>
          <span>{restNote}</span>
          {nextDay && <span style={{ whiteSpace: 'nowrap' }}>{t('{0} below ↓', nextDay.name)}</span>}
        </div>
      </div>
    })}

    <h4 className="eyebrow" style={{ margin: '22px 0 2px' }}>{t('Coach schedule')}</h4>
    {assigned.upcoming.length ? <div className="blocklist">{assigned.upcoming.slice(0, 12).map(item => {
      const label = item.state === 'started' ? t('In progress')
        : item.customized && item.overrideDate ? t('Customized · Rescheduled')
          : item.customized ? t('Customized')
            : item.overrideDate ? t('Rescheduled')
              : item.scheduledDate === assigned.relationshipDate ? t('Today') : t('Scheduled')
      const statusKey = item.state === 'started' ? 'in-progress'
        : item.customized ? 'customized'
          : item.overrideDate ? 'rescheduled' : 'scheduled'
      return <div className="row between" key={item.id}>
        <div className="grow"><div className="tt">{item.prescription.dayName}</div><div className="ss">{fmtCoachDate(item.scheduledDate)} · {workspace.relationship.timeZone}</div></div>
        <StatusBadge status={statusKey} label={label} />
      </div>
    })}</div> : <div className="bcell"><EmptyState icon="calendar" description={t('No upcoming workouts are scheduled.')} /></div>}
    {assigned.canceled.length > 0 && <>
      <h4 className="eyebrow" style={{ margin: '22px 0 2px' }}>{t('Days off')}</h4>
      <div className="blocklist">{assigned.canceled.slice(0, 12).map(item => <div className="row between" key={item.id}>
        <div className="grow"><div className="tt">{item.prescription.dayName}</div><div className="ss">{fmtCoachDate(item.scheduledDate)} · {workspace.relationship.timeZone}</div></div>
        <StatusBadge status="day-off" label={t('Day off')} />
      </div>)}</div>
    </>}
  </>
}

function coachWeekday(value) {
  return t(DAYN[Number(value) % 7])
}

function coachExerciseLine(exercise, planUnit) {
  const first = exercise.sets?.[0] || {}
  const count = exercise.sets?.length || 0
  const unit = exercise.unit || planUnit
  if (exercise.mode === 'cardio') return `${count} ${t(count === 1 ? 'set' : 'sets')} · ${first.minutes || 0} min${first.speed ? ` · ${first.speed} km/h` : ''}`
  if (exercise.mode === 'time') return `${count} ${t(count === 1 ? 'set' : 'sets')} · ${first.seconds || 0}s${first.weight ? ` · ${first.weight} ${unit}` : ''} · ${exercise.restSec || 0}s ${t('rest')}`
  return `${count} ${t(count === 1 ? 'set' : 'sets')} · ${first.reps || 0} ${t('reps')}${first.weight ? ` · ${first.weight} ${unit}` : ''} · ${exercise.restSec || 0}s ${t('rest')}`
}

function fmtCoachDate(value) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
