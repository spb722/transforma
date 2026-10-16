import { create } from 'zustand'
import { coachingApi } from '../lib/coaching/api.js'
import { assignedOutbox } from '../lib/coaching/outbox.js'
import { activeOwnRelationship } from '../lib/coaching/schedule.js'

const ownCacheKey = userId => `coaching_v1_${userId}`
const browserStorage = () => typeof localStorage === 'undefined' ? null : localStorage

function readOwnCache(userId) {
  if (!userId) return null
  try { return JSON.parse(browserStorage()?.getItem(ownCacheKey(userId)) || 'null') } catch { return null }
}

function writeOwnCache(userId, value) {
  if (!userId) return
  try {
    if (value) browserStorage()?.setItem(ownCacheKey(userId), JSON.stringify(value))
    else browserStorage()?.removeItem(ownCacheKey(userId))
  } catch { /* cache is optional */ }
}

async function fetchOwnWorkspace(relationshipId) {
  const [workspace, sessions] = await Promise.all([
    coachingApi(`/workspace?relationshipId=${encodeURIComponent(relationshipId)}`),
    coachingApi(`/sessions?relationshipId=${encodeURIComponent(relationshipId)}`)
  ])
  const startedSession = sessions?.items?.find(item => item.state === 'started') || null
  return { ...workspace, startedSession, cachedAt: Date.now() }
}

let refreshTimer = null
let focusListener = null
let ownRefreshTimer = null
let ownFocusListener = null

export const useCoachingStore = create((set, get) => {
  let userGeneration = 0
  const requests = { bootstrap: 0, own: 0, ownView: 0, overview: 0, workspace: 0, save: 0 }
  const begin = kind => ({ kind, id: ++requests[kind], userId: get().userId, generation: userGeneration })
  const current = request => request.userId === get().userId && request.generation === userGeneration && requests[request.kind] === request.id
  return ({
  userId: null,
  bootstrap: null,
  ownWorkspace: null,
  ownViewedWorkspace: null,
  trainerOverview: null,
  trainerWorkspace: null,
  loading: false,
  saving: false,
  error: null,
  lastLoadedAt: null,

  bindUser(user) {
    const nextId = user?.id || null
    if (get().userId === nextId) return
    userGeneration += 1
    get().stopRevalidation()
    get().stopOwnRevalidation()
    set({
      userId: nextId,
      bootstrap: null,
      ownWorkspace: readOwnCache(nextId),
      ownViewedWorkspace: null,
      trainerOverview: null,
      trainerWorkspace: null,
      loading: false,
      saving: false,
      error: null,
      lastLoadedAt: null
    })
    if (nextId) get().syncAssignedResults().catch(() => {})
  },

  async syncAssignedResults() {
    const userId = get().userId
    const generation = userGeneration
    if (!userId || !assignedOutbox.pending(userId).length) return []
    const pending = await assignedOutbox.flush(userId, item => {
      if (get().userId !== userId || generation !== userGeneration) throw new Error('The signed-in profile changed')
      return coachingApi('/sessions/result', { method: 'PUT', body: { ...item, queuedAt: undefined } })
    })
    if (get().userId === userId && generation === userGeneration) await get().refreshOwnCoaching()
    return pending
  },

  async loadBootstrap() {
    if (!get().userId) return null
    const request = begin('bootstrap')
    set({ loading: true, error: null })
    try {
      const bootstrap = await coachingApi('/bootstrap')
      if (!current(request)) return null
      set({ bootstrap, loading: false, lastLoadedAt: Date.now() })
      return bootstrap
    } catch (error) {
      if (!current(request)) throw error
      if ([401, 403, 404].includes(error.status)) get().clearTrainerData()
      set({ loading: false, error })
      throw error
    }
  },

  async loadOwnWorkspace(relationshipId) {
    if (!get().userId) return null
    const request = begin('ownView')
    set({ error: null })
    if (get().ownViewedWorkspace?.relationship?.id !== relationshipId) set({ ownViewedWorkspace: null })
    try {
      const data = await fetchOwnWorkspace(relationshipId)
      if (!current(request)) return null
      // An archived route must survive active-coaching refreshes without becoming
      // the personal app's active assignment or replacing its offline cache.
      if (data.relationship.status === 'active') {
        writeOwnCache(request.userId, data)
        set({ ownWorkspace: data })
      }
      set({ ownViewedWorkspace: data, lastLoadedAt: Date.now(), error: null })
      return data
    } catch (error) {
      if (current(request)) {
        if ([401, 403, 404].includes(error.status)) {
          set({ ownViewedWorkspace: null })
          if (error.status === 401) {
            requests.own += 1
            writeOwnCache(request.userId, null)
            set({ ownWorkspace: null, bootstrap: null })
          }
        }
        set({ error })
      }
      throw error
    }
  },

  async refreshOwnCoaching() {
    if (!get().userId) return null
    const request = begin('own')
    const bootstrapRequest = begin('bootstrap')
    set({ loading: true })
    try {
      const bootstrap = await coachingApi('/bootstrap')
      if (!current(request) || !current(bootstrapRequest)) return null
      const active = activeOwnRelationship(bootstrap)
      if (!active) {
        writeOwnCache(request.userId, null)
        set({ bootstrap, ownWorkspace: null, error: null, loading: false, lastLoadedAt: Date.now() })
        return { bootstrap, workspace: null }
      }
      const workspace = await fetchOwnWorkspace(active.id)
      if (!current(request) || !current(bootstrapRequest)) return null
      writeOwnCache(request.userId, workspace)
      set({ bootstrap, ownWorkspace: workspace, error: null, loading: false, lastLoadedAt: Date.now() })
      return { bootstrap, workspace }
    } catch (error) {
      if (!current(request) || !current(bootstrapRequest)) throw error
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        requests.ownView += 1
        writeOwnCache(request.userId, null)
        set({ bootstrap: null, ownWorkspace: null, ownViewedWorkspace: null })
      }
      set({ error, loading: false })
      throw error
    }
  },

  async loadTrainerOverview() {
    if (!get().userId) return null
    const request = begin('overview')
    try {
      const trainerOverview = await coachingApi('/overview')
      if (!current(request)) return null
      set({ trainerOverview, error: null, lastLoadedAt: Date.now() })
      return trainerOverview
    } catch (error) {
      if (!current(request)) throw error
      get().clearTrainerData()
      set({ error })
      throw error
    }
  },

  async loadTrainerWorkspace(relationshipId) {
    if (!get().userId) return null
    const request = begin('workspace')
    set({ error: null })
    if (get().trainerWorkspace?.relationship?.id !== relationshipId) set({ trainerWorkspace: null })
    try {
      const trainerWorkspace = await coachingApi(`/workspace?relationshipId=${encodeURIComponent(relationshipId)}`)
      if (!current(request)) return null
      set({ trainerWorkspace, error: null, lastLoadedAt: Date.now() })
      return trainerWorkspace
    } catch (error) {
      if (!current(request)) throw error
      set({ trainerWorkspace: null, error })
      throw error
    }
  },

  async save(action) {
    const request = begin('save')
    set({ saving: true, error: null })
    try {
      const result = await action()
      if (current(request)) set({ saving: false })
      return result
    } catch (error) {
      if (current(request)) set({ saving: false, error })
      throw error
    }
  },

  startRevalidation(loader) {
    get().stopRevalidation()
    if (typeof window === 'undefined' || typeof loader !== 'function') return
    const refresh = () => { if (document.visibilityState !== 'hidden') Promise.resolve(loader()).catch(() => {}) }
    refreshTimer = window.setInterval(refresh, 30_000)
    focusListener = refresh
    window.addEventListener('focus', focusListener)
  },

  startOwnRevalidation() {
    if (ownRefreshTimer && typeof window !== 'undefined') window.clearInterval(ownRefreshTimer)
    if (ownFocusListener && typeof window !== 'undefined') window.removeEventListener('focus', ownFocusListener)
    if (typeof window === 'undefined' || !get().userId) return
    const refresh = () => { if (document.visibilityState !== 'hidden') get().refreshOwnCoaching().catch(() => {}) }
    ownRefreshTimer = window.setInterval(refresh, 30_000)
    ownFocusListener = refresh
    window.addEventListener('focus', ownFocusListener)
  },

  stopOwnRevalidation() {
    if (ownRefreshTimer && typeof window !== 'undefined') window.clearInterval(ownRefreshTimer)
    if (ownFocusListener && typeof window !== 'undefined') window.removeEventListener('focus', ownFocusListener)
    ownRefreshTimer = null
    ownFocusListener = null
  },

  stopRevalidation() {
    if (refreshTimer && typeof window !== 'undefined') window.clearInterval(refreshTimer)
    if (focusListener && typeof window !== 'undefined') window.removeEventListener('focus', focusListener)
    refreshTimer = null
    focusListener = null
  },

  clearTrainerData() {
    requests.overview += 1
    requests.workspace += 1
    requests.bootstrap += 1
    set({ trainerOverview: null, trainerWorkspace: null })
  },
  clearError() { set({ error: null }) }
  })
})
