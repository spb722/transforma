import { describe, expect, it } from 'vitest'
import { dateInZone, mondayInZone } from './dates.js'

describe('coaching business dates', () => {
  it('uses the relationship zone across a UTC day and year boundary', () => {
    const instant = new Date('2025-12-31T20:00:00Z')
    expect(dateInZone(instant, 'Asia/Kolkata')).toBe('2026-01-01')
    expect(mondayInZone(instant, 'Asia/Kolkata')).toBe('2025-12-29')
  })
})
