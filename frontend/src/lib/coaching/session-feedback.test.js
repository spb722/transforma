import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedbackDraft, sendSessionFeedback, storeFeedbackDraft } from './session-feedback.js'

function memoryStorage() {
  const values = new Map()
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  }
}

const response = body => ({ ok: true, status: 200, json: async () => ({ data: body }) })

describe('session feedback drafts', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete globalThis.localStorage
  })

  it('keeps one exact mutation request across an offline failure and retry', async () => {
    globalThis.localStorage = memoryStorage()
    globalThis.fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Network offline'))
      .mockResolvedValueOnce(response({ version: 1 }))
    const draft = { content: { note: 'Knee felt sore', difficulty: 4, pain: 3 }, version: 0 }

    await expect(sendSessionFeedback('client-a', 'session-1', draft)).rejects.toThrow('Network offline')
    const pending = feedbackDraft('client-a', 'session-1')
    expect(pending.request).toMatchObject({ sessionId: 'session-1', expectedVersion: 0, note: 'Knee felt sore' })
    expect(pending.request.mutationId).toMatch(/^[0-9a-f-]{36}$/)

    await sendSessionFeedback('client-a', 'session-1', pending)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(globalThis.fetch.mock.calls[0][1].body).toBe(globalThis.fetch.mock.calls[1][1].body)
    expect(feedbackDraft('client-a', 'session-1')).toBeNull()
  })

  it('keeps drafts isolated by account and session', () => {
    globalThis.localStorage = memoryStorage()
    const draft = { content: { note: 'Private detail', difficulty: null, pain: null }, version: 0 }
    storeFeedbackDraft('client-a', 'session-1', draft)

    expect(feedbackDraft('client-a', 'session-1')).toEqual(draft)
    expect(feedbackDraft('client-b', 'session-1')).toBeNull()
    expect(feedbackDraft('client-a', 'session-2')).toBeNull()
  })
})

it('preserves the exact pending mutation on reload unless resolving a confirmed version conflict', async () => {
  const { reloadedFeedbackDraft } = await import('./session-feedback.js')
  const pending = { content: { note: 'Knee discomfort', pain: 3 }, version: 1, request: { mutationId: 'retry-same', expectedVersion: 1 } }
  expect(reloadedFeedbackDraft(pending, { note: 'Changed locally' }, 2)).toBe(pending)
  expect(reloadedFeedbackDraft(pending, {}, 2, true)).toEqual({ content: pending.content, version: 2 })
})
