import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCoachingStore } from './useCoachingStore.js'

const response = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(status < 400 ? { data } : { error: data }), { status, headers: { 'Content-Type': 'application/json' } }))
const nativeFetch = globalThis.fetch

describe('own coaching refresh', () => {
  let focusHandler
  beforeEach(() => {
    vi.useFakeTimers()
    const values = new Map()
    globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
    globalThis.document = { visibilityState: 'visible' }
    globalThis.window = {
      setInterval, clearInterval,
      addEventListener: (name, fn) => { if (name === 'focus') focusHandler = fn },
      removeEventListener: () => {}
    }
    useCoachingStore.setState({ userId: 'client', bootstrap: null, ownWorkspace: null, error: null })
  })
  afterEach(() => {
    useCoachingStore.getState().stopOwnRevalidation()
    vi.useRealTimers()
    vi.restoreAllMocks()
    delete globalThis.localStorage
    delete globalThis.document
    delete globalThis.window
    globalThis.fetch = nativeFetch
  })

  it('loads bootstrap plus the active workspace and refreshes on focus and 30 seconds', async () => {
    const bootstrap = { relationships: [{ id: 'rel', status: 'active' }] }
    const workspace = { relationship: { id: 'rel', status: 'active', timeZone: 'UTC' }, workout: null }
    const sessions = { items: [{ sessionId: 'started', state: 'started' }] }
    globalThis.fetch = vi.fn((url) => String(url).includes('/bootstrap') ? response(bootstrap) : String(url).includes('/sessions') ? response(sessions) : response(workspace))
    await useCoachingStore.getState().refreshOwnCoaching()
    expect(useCoachingStore.getState().ownWorkspace).toEqual({ ...workspace, startedSession: sessions.items[0] })
    useCoachingStore.getState().startOwnRevalidation()
    focusHandler()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/bootstrap')).length).toBeGreaterThanOrEqual(3)
  })

  it('clears stale own data when access is denied or no relationship remains', async () => {
    useCoachingStore.setState({ ownWorkspace: { relationship: { id: 'old' } } })
    globalThis.fetch = vi.fn(() => response({ relationships: [] }))
    await useCoachingStore.getState().refreshOwnCoaching()
    expect(useCoachingStore.getState().ownWorkspace).toBeNull()
    useCoachingStore.setState({ ownWorkspace: { relationship: { id: 'old' } } })
    globalThis.fetch = vi.fn(() => response({ code: 'NOT_FOUND', message: 'Unavailable' }, 404))
    await expect(useCoachingStore.getState().refreshOwnCoaching()).rejects.toMatchObject({ status: 404 })
    expect(useCoachingStore.getState().ownWorkspace).toBeNull()
  })
})
