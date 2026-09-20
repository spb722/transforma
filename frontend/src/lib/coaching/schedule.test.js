import { describe, expect, it } from 'vitest'
import { activeOwnRelationship, hasActiveCoachPlan, occurrenceOnDate, ownAssignmentSchedule } from './schedule.js'

describe('own coaching schedule projection', () => {
  it('uses the relationship date and keeps moved and canceled rows distinct', () => {
    const workspace = {
      relationship: { id: 'r1', status: 'active', timeZone: 'Pacific/Kiritimati' },
      workout: { content: { days: [] }, occurrences: [
        { id: 'moved', state: 'scheduled', scheduledDate: '2026-09-08', originalDate: '2026-09-07', overrideDate: '2026-09-08' },
        { id: 'canceled', state: 'canceled', scheduledDate: '2026-09-08', cancellationReason: 'explicit' },
        { id: 'replaced', state: 'canceled', scheduledDate: '2026-09-09', cancellationReason: 'plan_removed' },
        { id: 'past', state: 'completed', scheduledDate: '2026-09-07' }
      ] }
    }
    const result = ownAssignmentSchedule(workspace, new Date('2026-09-07T12:30:00Z'))
    expect(result.relationshipDate).toBe('2026-09-08')
    expect(result.today?.id).toBe('moved')
    expect(result.canceled.map(row => row.id)).toEqual(['canceled'])
    expect(occurrenceOnDate(workspace, '2026-09-09')).toBeNull()
    expect(result.past.map(row => row.id)).toEqual(['past'])
  })

  it('returns no assignment for an ended relationship', () => {
    expect(ownAssignmentSchedule({ relationship: { status: 'ended', timeZone: 'UTC' }, workout: { occurrences: [] } }).today).toBeNull()
    expect(activeOwnRelationship({ relationships: [{ id: 'old', status: 'ended' }, { id: 'active', status: 'active' }] }).id).toBe('active')
  })

  it('enters exclusive coached mode only for an active relationship with a published plan', () => {
    expect(hasActiveCoachPlan({ relationship: { status: 'active' }, workout: { content: { days: [] } } })).toBe(true)
    expect(hasActiveCoachPlan({ relationship: { status: 'active' }, workout: null })).toBe(false)
    expect(hasActiveCoachPlan({ relationship: { status: 'ended' }, workout: { content: { days: [] } } })).toBe(false)
  })

  it('treats a server-started session as resumable today and exposes canceled exceptions', () => {
    const workspace = { relationship: { status: 'active', timeZone: 'UTC' }, workout: { content: { days: [] }, occurrences: [
      { id: 'started', scheduledDate: '2026-09-13', state: 'started' },
      { id: 'canceled', scheduledDate: '2026-09-14', state: 'canceled', cancellationReason: 'explicit' }
    ] } }
    const result = ownAssignmentSchedule(workspace, new Date('2026-09-13T12:00:00Z'))
    expect(result.today?.id).toBe('started')
    expect(result.upcoming.map(row => row.id)).toContain('started')
    expect(result.past).toEqual([])
    expect(result.canceled.map(row => row.id)).toEqual(['canceled'])
    expect(occurrenceOnDate(workspace, '2026-09-14')?.state).toBe('canceled')
  })
})
