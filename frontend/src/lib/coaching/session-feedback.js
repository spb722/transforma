import { coachingApi, mutationId } from './api.js'

const key = (userId, sessionId) => `transforma_session_feedback_v1_${userId}_${sessionId}`
export function feedbackDraft(userId, sessionId) {
  try { return JSON.parse(localStorage.getItem(key(userId, sessionId)) || 'null') } catch { return null }
}
export function storeFeedbackDraft(userId, sessionId, draft) {
  if (!userId) throw new Error('Sign in to save feedback')
  localStorage.setItem(key(userId, sessionId), JSON.stringify(draft))
}
export async function sendSessionFeedback(userId, sessionId, draft) {
  const request = draft.request || { ...draft.content, sessionId, expectedVersion: draft.version, mutationId: mutationId() }
  // Persist the exact request before sending so a lost response can be retried safely.
  storeFeedbackDraft(userId, sessionId, { ...draft, request })
  const result = await coachingApi('/sessions/feedback', { method: 'PUT', body: request })
  localStorage.removeItem(key(userId, sessionId))
  return result
}

// Only a confirmed version conflict lets Reload rebase an unacknowledged mutation.
export function reloadedFeedbackDraft(draft, content, version, resolveConflict = false) {
  if (draft?.request && !resolveConflict) return draft
  return { content: draft?.content || content, version }
}
