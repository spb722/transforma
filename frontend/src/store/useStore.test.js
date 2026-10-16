import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { api } = vi.hoisted(() => ({ api: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api }))
vi.mock('../lib/format.js', () => ({ localTZ: () => 'UTC' }))
vi.mock('../lib/exercises.js', () => ({ registerCustom: vi.fn() }))
vi.mock('../lib/demo.js', () => ({ DEMO: false, DEMO_SEEDED: 'demo' }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))

let useStore, DEF, values
const privateState = { workouts: [{ id: 'only-a' }], bodyweight: [{ w: 73.2 }], routines: [] }
const denied = () => Object.assign(new Error('Sign in'), { status: 401 })

beforeEach(async () => {
  vi.resetModules()
  api.mockReset()
  values = new Map()
  globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  globalThis.document = { addEventListener: vi.fn(), visibilityState: 'visible' }
  ;({ useStore, DEF } = await import('./useStore.js'))
})
afterEach(() => {
  useStore.getState().setUser(null)
  delete globalThis.localStorage
  delete globalThis.document
})

it('clears expired account data before an empty different account can import it', async () => {
  const store = useStore.getState()
  store.setUser({ id: 'a' })
  store.replaceState({ ...DEF, ...privateState })
  api.mockImplementation(path => path === '/api/config' ? Promise.resolve({}) : Promise.reject(denied()))
  await store.boot()
  expect(useStore.getState().user).toBeNull()
  expect(useStore.getState().S.workouts).toEqual([])
  expect(useStore.getState().S.bodyweight).toEqual([])
  store.setUser({ id: 'b' })
  api.mockResolvedValue({ state: null })
  await store.pullState()
  expect(api.mock.calls.filter(([, options]) => options?.method === 'PUT')).toEqual([])
  expect(values.get('gym_state_owner')).toBe('b')
})

it('preserves unowned guest history when the guest creates a profile', async () => {
  const store = useStore.getState()
  store.replaceState({ ...DEF, ...privateState })
  store.setGuest(true)
  api.mockImplementation(path => path === '/api/config' ? Promise.resolve({}) : Promise.reject(denied()))
  await store.boot()
  expect(useStore.getState().S.workouts).toEqual(privateState.workouts)
  store.setUser({ id: 'first-profile' })
  api.mockResolvedValue({ state: null })
  await store.pullState()
  expect(api.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body).toContain('only-a')
})

it('discards a private response that arrives after an account switch', async () => {
  let resolve
  api.mockReturnValue(new Promise(done => { resolve = done }))
  const store = useStore.getState()
  store.setUser({ id: 'a' })
  const pending = store.pullState()
  store.setUser({ id: 'b' })
  resolve({ state: privateState })
  await pending
  expect(useStore.getState().S.workouts).toEqual([])
  expect(values.get('gym_state_owner')).toBe('b')
})

it('does not mark a new profile dirty when an old upload fails late', async () => {
  let reject
  api.mockReturnValue(new Promise((_, fail) => { reject = fail }))
  const store = useStore.getState()
  store.setUser({ id: 'a' })
  store.replaceState({ ...DEF, ...privateState })
  const pending = store.pushState()
  store.setUser({ id: 'b' })
  reject(denied())
  await pending
  expect(useStore.getState().user.id).toBe('b')
  expect(values.has('gym_dirty')).toBe(false)
  expect(useStore.getState().S.workouts).toEqual([])
})

it('keeps the signed-in profile and local history during a genuine network outage', async () => {
  const store = useStore.getState()
  store.setUser({ id: 'a' })
  store.replaceState({ ...DEF, ...privateState })
  api.mockRejectedValue(new Error('Network offline'))
  await store.boot()
  expect(useStore.getState().user.id).toBe('a')
  expect(useStore.getState().S.workouts).toEqual(privateState.workouts)
})

it('keeps an unsynced empty reset instead of restoring stale server history', async () => {
  const store = useStore.getState()
  store.setUser({ id: 'a' })
  store.replaceState({ ...DEF })
  localStorage.setItem('gym_dirty', '1')
  api.mockImplementation((_, options) => options?.method === 'PUT' ? Promise.resolve({}) : Promise.resolve({ state: privateState }))
  await store.pullState()
  expect(useStore.getState().S.workouts).toEqual([])
  expect(JSON.parse(api.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body).state.workouts).toEqual([])
  expect(values.has('gym_dirty')).toBe(false)
})
