import { describe, expect, it } from 'vitest'
import { buildAcceptance, clearJoinIntent, joinIntent, rememberJoinIntent, modesFor } from './join.js'

function memoryStorage() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

describe('coaching join intent', () => {
  it('survives a same-tab passkey flow and is consumed explicitly', () => {
    const storage = memoryStorage()
    rememberJoinIntent('private-token', storage)
    expect(joinIntent(storage)).toBe('private-token')
    clearJoinIntent(storage)
    expect(joinIntent(storage)).toBe(null)
  })

  it('requires affirmative current consent before constructing acceptance', () => {
    expect(() => buildAcceptance({ token: 't', consentVersion: 1, confirmSharing: false })).toThrow(/confirm/i)
    expect(buildAcceptance({ token: 't', consentVersion: 1, confirmSharing: true })).toEqual({ token: 't', consentVersion: 1, confirmSharing: true })
  })

  it('derives navigation only from server capabilities and own relationships', () => {
    expect(modesFor({ capabilities: { trainer: true }, relationships: [] })).toEqual(['studio', 'personal'])
    expect(modesFor({ capabilities: { trainer: false }, relationships: [{ status: 'active' }] })).toEqual(['coaching', 'personal'])
    expect(modesFor({ capabilities: { trainer: false }, relationships: [] })).toEqual(['personal'])
  })
})
