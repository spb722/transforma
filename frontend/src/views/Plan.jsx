import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button, StatusBadge, EmptyState } from '../components/ui.jsx'
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

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{coachPlanActive ? t('Your coach-assigned schedule') : t('Your weekly routine')}</div></div>
      {!coachPlanActive && coachOn && <button className="iconbtn" onClick={() => nav('/coach')} aria-label={t('Coach')} title={t('Coach')}><Icon name="sparkles" /></button>}
      {!coachPlanActive && <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>}
    </div>
    {coachPlanActive ? <CoachAssignedPlan workspace={ownWorkspace} assigned={assigned} /> : <div className="cols"><div>
      <h4 className="sec">{t('Week schedule')}</h4>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const r = S.routines.find(x => x.id === S.week[d])
          return <div key={d} className="item" onClick={() => dayAssignSheet(d)}>
            <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
            {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
            <Icon name="chevronRight" className="chev" /></div>
        })}
      </div>
    </div><div>
      <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>
      </div>
      {S.routines.length ? <div className="list">{S.routines.map(r => <div key={r.id} className="item" onClick={() => nav('/plan/r/' + r.id)}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
        <Icon name="chevronRight" className="chev" /></div>)}</div> : (
        <EmptyState
          icon="clipboard"
          title={t('No routines yet.')}
          description={t('Create one or load the starter plan.')}
          action={<Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>}
        />
      )}
    </div></div>}
  </>
}

function CoachAssignedPlan({ workspace, assigned }) {
  const plan = workspace.workout.content
  return <div className="narrow">
    {/* Trainer-authored content is marked with the dedicated trainer-authority
        tokens (border + badge), not the client's personal accent — the signal
        must read the same regardless of which of the 8 accent colors this
        client has chosen (FR-007, contracts/ui-component-contract.md §1). */}
    <div className="card" style={{ marginBottom: 18, borderColor: 'var(--trainer-text)' }}>
      <div className="row between"><div><div className="lbl2">{t('Coach-assigned plan')}</div><div className="big">{plan.name}</div></div><StatusBadge status="read-only" label={t('Read only')} /></div>
      <div className="small muted" style={{ marginTop: 8 }}>{t('Your trainer manages this plan and its schedule.')}</div>
    </div>

    <h4 className="sec">{t('Training plan')}</h4>
    <div style={{ display: 'grid', gap: 12 }}>
      {plan.days.map(day => <div className="card" key={day.id}>
        <div className="row between" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>{day.name}</h2>
          <span className="tag">{(day.weekdays || []).map(coachWeekday).join(' · ')}</span>
        </div>
        <div className="list">{day.exercises.map(exercise => <div className="item" key={exercise.entryId || exercise.id}>
          <span className="lrow-i"><Icon name="dumbbell" /></span>
          <div className="grow">
            <div className="tt">{exercise.name}</div>
            <div className="ss">{coachExerciseLine(exercise, plan.unit)}</div>
            {exercise.notes && <div className="small muted" style={{ marginTop: 4 }}>{exercise.notes}</div>}
          </div>
        </div>)}</div>
      </div>)}
    </div>

    <h4 className="sec" style={{ marginTop: 22 }}>{t('Coach schedule')}</h4>
    <div className="card">
      {assigned.upcoming.length ? <div className="list">{assigned.upcoming.slice(0, 12).map(item => {
        const label = item.state === 'started' ? t('In progress')
          : item.customized && item.overrideDate ? t('Customized · Rescheduled')
            : item.customized ? t('Customized')
              : item.overrideDate ? t('Rescheduled')
                : item.scheduledDate === assigned.relationshipDate ? t('Today') : t('Scheduled')
        const statusKey = item.state === 'started' ? 'in-progress'
          : item.customized ? 'customized'
            : item.overrideDate ? 'rescheduled' : 'scheduled'
        return <div className="item" key={item.id}>
          <span className="lrow-i"><Icon name="calendar" /></span>
          <div className="grow"><div className="tt">{item.prescription.dayName}</div><div className="ss">{fmtCoachDate(item.scheduledDate)} · {workspace.relationship.timeZone}</div></div>
          <StatusBadge status={statusKey} label={label} />
        </div>
      })}</div> : <EmptyState icon="calendar" description={t('No upcoming workouts are scheduled.')} />}
    </div>
    {assigned.canceled.length > 0 && <>
      <h4 className="sec" style={{ marginTop: 22 }}>{t('Days off')}</h4>
      <div className="card"><div className="list">{assigned.canceled.slice(0, 12).map(item => <div className="item" key={item.id}>
        <span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="xmark" /></span>
        <div className="grow"><div className="tt">{item.prescription.dayName}</div><div className="ss">{fmtCoachDate(item.scheduledDate)} · {workspace.relationship.timeZone}</div></div>
        <StatusBadge status="day-off" label={t('Day off')} />
      </div>)}</div></div>
    </>}
  </div>
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
