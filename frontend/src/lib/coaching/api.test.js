import { afterEach, describe, expect, it, vi } from 'vitest'
import { retryableCoachingMutation } from './api.js'

const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

describe('retryable coaching mutations', () => {
  afterEach(() => vi.restoreAllMocks())

  it('retries one server failure with the same mutation ID', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(response(500, { error: { code: 'INTERNAL', message: 'Server error' } }))
      .mockResolvedValueOnce(response(200, { data: { version: 8 } }))

    await expect(retryableCoachingMutation('/plans/publish', { relationshipId: 'relationship' })).resolves.toEqual({ version: 8 })
    const first = JSON.parse(globalThis.fetch.mock.calls[0][1].body)
    const second = JSON.parse(globalThis.fetch.mock.calls[1][1].body)
    expect(first.mutationId).toMatch(/^[0-9a-f-]{36}$/)
    expect(second.mutationId).toBe(first.mutationId)
  })

  it('does not retry a validation or conflict response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(response(409, { error: { code: 'VERSION_CONFLICT', message: 'Reload' } }))
    await expect(retryableCoachingMutation('/plans/publish', {})).rejects.toMatchObject({ status: 409 })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
