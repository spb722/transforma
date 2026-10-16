import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ user: { id: 'client' }, S: { active: null, workouts: [], customEx: [] }, workspace: null, pending: [] }))
const api = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const stopRest = vi.hoisted(() => vi.fn())
vi.mock('../../store/useStore.js', () => ({ useStore: { getState: () => ({ ...state, update: fn => fn(state.S) }) } }))
vi.mock('../../store/useCoachingStore.js', () => ({ useCoachingStore: { getState: () => ({ ownWorkspace: state.workspace }) } }))
vi.mock('../../store/useUI.js', () => ({ useUI: { getState: () => ({ stopRest }) } }))
vi.mock('./api.js', () => ({ coachingApi: api, mutationId: () => 'session' }))
vi.mock('../nav.js', () => ({ nav: navigate }))
vi.mock('./outbox.js', () => ({ assignedOutbox: { pending: () => state.pending } }))
import { beginAssignedWorkout } from '../../sheets.jsx'
const occurrence = { id: 'occurrence', state: 'started', version: 1 }
const started = { sessionId: 'session', state: 'started', occurrenceId: 'occurrence', relationshipId: 'relationship', scheduledDate: '2026-10-02', startedAt: '2026-10-02T06:00:00Z', prescriptionSnapshot: { unit: 'kg', exercises: [] } }
beforeEach(() => {
  state.user = { id: 'client' }; state.S = { active: null, workouts: [], customEx: [] }; state.workspace = { relationship: { id: 'relationship' }, startedSession: started }; state.pending = []
  vi.clearAllMocks()
})
describe('assigned session start and resume', () => {
  it('resumes the exact local object, preserving logged sets and running rest timer offline', async () => {
    const active = { assignedSessionId: 'session', occurrenceId: 'occurrence', cur: 2, entries: [{ sets: [{ done: true, w: 65, r: 8 }] }] }
    state.S.active = active
    await beginAssignedWorkout(occurrence)
    expect(state.S.active).toBe(active)
    expect(api).not.toHaveBeenCalled()
    expect(stopRest).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/workout')
  })
  it.each([{ id: 'personal' }, { assignedSessionId: 'other', occurrenceId: 'other' }])('does not overwrite a different active workout', async active => {
    state.S.active = active
    await expect(beginAssignedWorkout(occurrence)).rejects.toThrow('Finish or discard')
    expect(state.S.active).toBe(active)
    expect(api).not.toHaveBeenCalled()
  })
  it('does not recreate an abandoned workout or a finished result awaiting upload', async () => {
    await expect(beginAssignedWorkout({ ...occurrence, displayState: 'abandoned' })).rejects.toThrow('ended')
    state.pending = [{ sessionId: 'session', state: 'finished' }]
    await expect(beginAssignedWorkout(occurrence)).rejects.toThrow('already saved')
    expect(state.S.active).toBeNull()
  })
  it('does not write a pending start response into a different signed-in profile', async () => {
    api.mockImplementationOnce(async () => { state.user = { id: 'other' }; return started })
    await expect(beginAssignedWorkout({ ...occurrence, state: 'scheduled' })).rejects.toThrow('profile changed')
    expect(state.S.active).toBeNull()
  })
  it('does not overwrite a workout opened while start is pending', async () => {
    const active = { id: 'personal' }
    api.mockImplementationOnce(async () => { state.S.active = active; return started })
    await expect(beginAssignedWorkout({ ...occurrence, state: 'scheduled' })).rejects.toThrow('Finish or discard')
    expect(state.S.active).toBe(active)
  })
})
