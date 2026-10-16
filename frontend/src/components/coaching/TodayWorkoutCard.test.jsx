import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import TodayWorkoutCard from './TodayWorkoutCard.jsx'

const state = vi.hoisted(() => ({ personal: { workouts: [], active: null }, pending: [] }))
vi.mock('../../store/useStore.js', () => ({ useStore: selector => selector({ S: state.personal }) }))
vi.mock('../../store/useCoachingStore.js', () => ({ useCoachingStore: selector => selector({ userId: 'client' }) }))
vi.mock('../../lib/coaching/outbox.js', () => ({ assignedOutbox: { pending: () => state.pending } }))
vi.mock('../../sheets.jsx', () => ({ beginAssignedWorkout: vi.fn() }))

const occurrence = { id: 'o1', scheduledDate: '2026-10-02', state: 'scheduled', prescription: { dayName: 'Full Body', exercises: [{}, {}, {}] } }
const workspace = { relationship: { id: 'r1', timeZone: 'Pacific/Kiritimati', status: 'active' }, occurrences: [occurrence], today: { date: '2026-10-02', state: 'scheduled', label: 'Scheduled', workoutName: 'Full Body', exerciseCount: 3, occurrenceId: 'o1' } }
const render = (value = workspace, mode = 'client') => renderToStaticMarkup(<MemoryRouter><TodayWorkoutCard workspace={value} mode={mode} onAssign={() => {}} onManage={() => {}} onProgress={() => {}} /></MemoryRouter>)

afterEach(() => { vi.useRealTimers(); state.personal = { workouts: [], active: null }; state.pending = [] })

describe('today workout card', () => {
  it('gives a client a start action with the coaching date and exercise count', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T12:30:00Z'))
    const html = render()
    for (const text of ['2026-10-02', 'Pacific/Kiritimati', 'Full Body', '3 exercises', 'Scheduled', 'Start workout', 'View workout details']) expect(html).toContain(text)
    expect(html).not.toContain('Manage this workout')
  })
  it('shows a trainer the started time and received-result boundary without an edit action', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T12:30:00Z'))
    const html = render({ ...workspace, occurrences: [{ ...occurrence, state: 'started' }], today: { ...workspace.today, state: 'in_progress', label: 'In progress', startedAt: '2026-10-01T12:10:00Z', syncStatus: 'awaiting_result' } }, 'trainer')
    expect(html).toContain('Started')
    expect(html).toContain('A finished result has not reached the server yet')
    expect(html).not.toContain('Start workout')
    expect(html).not.toContain('Manage this workout')
  })
  it('keeps an offline finished result distinct from in progress and hides resume', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T12:30:00Z'))
    state.pending = [{ sessionId: 's1', clientFinishedAt: '2026-10-01T12:20:00Z' }]
    const html = render({ ...workspace, occurrences: [{ ...occurrence, state: 'started' }], today: { ...workspace.today, sessionId: 's1', state: 'in_progress', label: 'In progress' } })
    expect(html).toContain('Waiting to sync')
    expect(html).toContain('Finished')
    expect(html).not.toContain('Resume workout')
  })
  it('offers continuation instead of replacing a locally active session', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-01T12:30:00Z'))
    state.personal.active = { id: 'existing' }
    expect(render()).toContain('Continue current workout')
  })
})
