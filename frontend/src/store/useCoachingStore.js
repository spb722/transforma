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
  return { ...workspace, startedSession }
}

let refreshTimer = null
let focusListener = null
let ownRefreshTimer = null
let ownFocusListener = null

export const useCoachingStore = create((set, get) => ({
  userId: null,
  bootstrap: null,
  ownWorkspace: null,
  trainerOverview: null,
  trainerWorkspace: null,
  loading: false,
  saving: false,
  error: null,
  lastLoadedAt: null,

  bindUser(user) {
    const nextId = user?.id || null
    if (get().userId === nextId) return
    get().stopRevalidation()
    get().stopOwnRevalidation()
    set({
      userId: nextId,
      bootstrap: null,
      ownWorkspace: readOwnCache(nextId),
      trainerOverview: null,
      trainerWorkspace: null,
      loading: false,
      saving: false,
      error: null,
      lastLoadedAt: null
    })
    if (nextId) assignedOutbox.flush(nextId, item => coachingApi('/sessions/result', { method: 'PUT', body: { ...item, queuedAt: undefined } })).catch(() => {})
  },

  async loadBootstrap() {
    if (!get().userId) return null
    set({ loading: true, error: null })
    try {
      const bootstrap = await coachingApi('/bootstrap')
      set({ bootstrap, loading: false, lastLoadedAt: Date.now() })
      return bootstrap
    } catch (error) {
      if (error.status === 401 || error.status === 404) set({ trainerOverview: null, trainerWorkspace: null })
      set({ loading: false, error })
      throw error
    }
  },

  async loadOwnWorkspace(relationshipId) {
    const data = await fetchOwnWorkspace(relationshipId)
    writeOwnCache(get().userId, data)
    set({ ownWorkspace: data, lastLoadedAt: Date.now(), error: null })
    return data
  },

  async refreshOwnCoaching() {
    if (!get().userId) return null
    try {
      const bootstrap = await coachingApi('/bootstrap')
      const active = activeOwnRelationship(bootstrap)
      if (!active) {
        writeOwnCache(get().userId, null)
        set({ bootstrap, ownWorkspace: null, error: null, lastLoadedAt: Date.now() })
        return { bootstrap, workspace: null }
      }
      const workspace = await fetchOwnWorkspace(active.id)
      writeOwnCache(get().userId, workspace)
      set({ bootstrap, ownWorkspace: workspace, error: null, lastLoadedAt: Date.now() })
      return { bootstrap, workspace }
    } catch (error) {
      if (error.status === 401 || error.status === 403 || error.status === 404) {
        writeOwnCache(get().userId, null)
        set({ bootstrap: null, ownWorkspace: null })
      }
      set({ error })
      throw error
    }
  },

  async loadTrainerOverview() {
    try {
      const trainerOverview = await coachingApi('/overview')
      set({ trainerOverview, error: null, lastLoadedAt: Date.now() })
      return trainerOverview
    } catch (error) {
      set({ trainerOverview: null, trainerWorkspace: null, error })
      throw error
    }
  },

  async loadTrainerWorkspace(relationshipId) {
    try {
      const trainerWorkspace = await coachingApi(`/workspace?relationshipId=${encodeURIComponent(relationshipId)}`)
      set({ trainerWorkspace, error: null, lastLoadedAt: Date.now() })
      return trainerWorkspace
    } catch (error) {
      set({ trainerWorkspace: null, error })
      throw error
    }
  },

  async save(action) {
    set({ saving: true, error: null })
    try {
      const result = await action()
      set({ saving: false })
      return result
    } catch (error) {
      set({ saving: false, error })
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

  clearTrainerData() { set({ trainerOverview: null, trainerWorkspace: null }) },
  clearError() { set({ error: null }) }
}))
