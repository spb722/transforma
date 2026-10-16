import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCoachingStore } from './useCoachingStore.js'
import { assignedOutbox, createOutbox } from '../lib/coaching/outbox.js'

const response = (data, status = 200) => Promise.resolve(new Response(JSON.stringify(status < 400 ? { data } : { error: data }), { status, headers: { 'Content-Type': 'application/json' } }))
const nativeFetch = globalThis.fetch
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve: data => resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } })) }
}

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
    expect(useCoachingStore.getState().ownWorkspace).toEqual({ ...workspace, startedSession: sessions.items[0], cachedAt: expect.any(Number) })
    expect(JSON.parse(localStorage.getItem('coaching_v1_client')).cachedAt).toBe(useCoachingStore.getState().ownWorkspace.cachedAt)
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

describe('coaching response ownership', () => {
  let values
  beforeEach(() => {
    values = new Map()
    globalThis.localStorage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
    useCoachingStore.getState().bindUser(null)
    useCoachingStore.getState().bindUser({ id: 'trainer-a' })
  })
  afterEach(() => {
    useCoachingStore.getState().bindUser(null)
    vi.restoreAllMocks()
    delete globalThis.localStorage
    globalThis.fetch = nativeFetch
  })

  it('does not restore bootstrap or trainer data after an account switch', async () => {
    const bootstrap = deferred(), overview = deferred(), workspace = deferred()
    globalThis.fetch = vi.fn(url => String(url).includes('/bootstrap') ? bootstrap.promise : String(url).includes('/overview') ? overview.promise : workspace.promise)
    const store = useCoachingStore.getState()
    const pending = [store.loadBootstrap(), store.loadTrainerOverview(), store.loadTrainerWorkspace('private-a')]
    store.bindUser({ id: 'ordinary-b' })
    bootstrap.resolve({ capabilities: { trainer: true } })
    overview.resolve({ items: [{ client: { name: 'Private A' } }] })
    workspace.resolve({ relationship: { id: 'private-a' } })
    expect(await Promise.all(pending)).toEqual([null, null, null])
    expect(useCoachingStore.getState()).toMatchObject({ userId: 'ordinary-b', bootstrap: null, trainerOverview: null, trainerWorkspace: null })
  })

  it('keeps the newest relationship when an older workspace arrives last', async () => {
    const first = deferred(), second = deferred()
    globalThis.fetch = vi.fn(url => String(url).includes('first') ? first.promise : second.promise)
    const store = useCoachingStore.getState()
    const older = store.loadTrainerWorkspace('first')
    const newer = store.loadTrainerWorkspace('second')
    second.resolve({ relationship: { id: 'second' }, diet: { content: { name: 'Second diet' } } })
    await newer
    first.resolve({ relationship: { id: 'first' }, diet: { content: { name: 'First diet' } } })
    expect(await older).toBeNull()
    expect(useCoachingStore.getState().trainerWorkspace.relationship.id).toBe('second')
  })

  it('invalidates pending trainer responses when coaching access is cleared', async () => {
    const pending = deferred()
    globalThis.fetch = vi.fn(() => pending.promise)
    const load = useCoachingStore.getState().loadTrainerWorkspace('ended')
    useCoachingStore.getState().clearTrainerData()
    pending.resolve({ relationship: { id: 'ended' }, diet: { content: { name: 'Private diet' } } })
    expect(await load).toBeNull()
    expect(useCoachingStore.getState().trainerWorkspace).toBeNull()
  })

  it('does not repopulate a private workspace after bootstrap denies the current session', async () => {
    const workspace = deferred()
    globalThis.fetch = vi.fn(url => String(url).includes('/bootstrap') ? response({ code: 'NOT_SIGNED_IN', message: 'Sign in to continue' }, 401) : workspace.promise)
    const store = useCoachingStore.getState()
    const load = store.loadTrainerWorkspace('revoked')
    await expect(store.loadBootstrap()).rejects.toMatchObject({ status: 401 })
    workspace.resolve({ relationship: { id: 'revoked' }, diet: { content: { name: 'Private revoked diet' } } })
    expect(await load).toBeNull()
    expect(useCoachingStore.getState().trainerWorkspace).toBeNull()
    expect(useCoachingStore.getState().loading).toBe(false)
  })

  it('never caches an old client workspace under a newly signed-in client', async () => {
    const workspace = deferred()
    globalThis.fetch = vi.fn(url => String(url).includes('/sessions') ? response({ items: [] }) : workspace.promise)
    const load = useCoachingStore.getState().loadOwnWorkspace('first-client')
    useCoachingStore.getState().bindUser({ id: 'second-client' })
    workspace.resolve({ relationship: { id: 'first-client' }, diet: { content: { name: 'Private first diet' } } })
    expect(await load).toBeNull()
    expect(values.has('coaching_v1_second-client')).toBe(false)
    expect(useCoachingStore.getState().ownWorkspace).toBeNull()
  })

  it('discards an old own refresh if the client changes while workspace requests are pending', async () => {
    const workspace = deferred()
    globalThis.fetch = vi.fn(url => String(url).includes('/bootstrap') ? response({ relationships: [{ id: 'first-rel', status: 'active' }] }) : String(url).includes('/sessions') ? response({ items: [] }) : workspace.promise)
    const load = useCoachingStore.getState().refreshOwnCoaching()
    await vi.waitFor(() => expect(fetch.mock.calls.length).toBe(3))
    useCoachingStore.getState().bindUser({ id: 'second-client' })
    workspace.resolve({ relationship: { id: 'first-rel' } })
    expect(await load).toBeNull()
    expect(values.has('coaching_v1_second-client')).toBe(false)
    expect(useCoachingStore.getState()).toMatchObject({ bootstrap: null, ownWorkspace: null })
  })

  it('keeps a viewed archive through an active refresh and never caches it as active', async () => {
    const archive = { relationship: { id: 'ended-rel', status: 'ended' }, diet: { content: { name: 'Retained diet' } } }
    globalThis.fetch = vi.fn(url => String(url).includes('/bootstrap') ? response({ relationships: [{ id: 'ended-rel', status: 'ended' }] }) : String(url).includes('/sessions') ? response({ items: [] }) : response(archive))
    await useCoachingStore.getState().loadOwnWorkspace('ended-rel')
    await useCoachingStore.getState().refreshOwnCoaching()
    expect(useCoachingStore.getState().ownViewedWorkspace.relationship.id).toBe('ended-rel')
    expect(useCoachingStore.getState().ownWorkspace).toBeNull()
    expect(values.has('coaching_v1_trainer-a')).toBe(false)
  })

  it('uploads queued assigned results when reconnect sync runs and refreshes the receipt', async () => {
    const outbox = createOutbox(globalThis.localStorage)
    vi.spyOn(assignedOutbox, 'pending').mockImplementation(outbox.pending)
    vi.spyOn(assignedOutbox, 'flush').mockImplementation(outbox.flush)
    outbox.enqueue('trainer-a', { sessionId: 'queued-session', result: { entries: [] } })
    globalThis.fetch = vi.fn(url => String(url).includes('/sessions/result') ? response({ sessionId: 'queued-session', state: 'completed' }) : response({ relationships: [] }))
    await useCoachingStore.getState().syncAssignedResults()
    expect(assignedOutbox.pending('trainer-a')).toEqual([])
    expect(fetch.mock.calls[0][0]).toContain('/sessions/result')
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/bootstrap'))).toBe(true)
  })
})
