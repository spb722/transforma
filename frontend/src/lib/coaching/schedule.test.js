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


describe('standalone one-time assignments', () => {
  it('shows and starts an assigned date even without a recurring plan', () => {
    const oneTime = { id: 'once', oneTime: true, state: 'scheduled', scheduledDate: '2026-10-02' }
    const workspace = { relationship: { status: 'active', timeZone: 'Pacific/Kiritimati' }, workout: null, occurrences: [oneTime] }
    expect(hasActiveCoachPlan(workspace, new Date('2026-10-01T12:00:00Z'))).toBe(true)
    const result = ownAssignmentSchedule(workspace, new Date('2026-10-01T12:00:00Z'))
    expect(result.today).toEqual(oneTime)
    expect(result.upcoming).toEqual([oneTime])
    expect(occurrenceOnDate(workspace, '2026-10-02')).toEqual(oneTime)
    expect(occurrenceOnDate(workspace, '2026-10-09')).toBeNull()
  })

  it('does not activate coaching for an ended one-time assignment', () => {
    const workspace = { relationship: { status: 'ended', timeZone: 'UTC' }, workout: null, occurrences: [{ id: 'once', state: 'scheduled', scheduledDate: '2026-10-01' }] }
    expect(hasActiveCoachPlan(workspace)).toBe(false)
    expect(ownAssignmentSchedule(workspace, new Date('2026-10-01T12:00:00Z')).today).toBeNull()
  })
})

it('does not offer Resume for an abandoned attempt whose occurrence remains locked', () => {
  const row = { id: 'abandoned', scheduledDate: '2026-10-02', state: 'started', displayState: 'abandoned' }
  const workspace = { relationship: { status: 'active', timeZone: 'UTC' }, occurrences: [row] }
  const result = ownAssignmentSchedule(workspace, new Date('2026-10-02T12:00:00Z'))
  expect(result.today).toBeNull()
  expect(result.todayStatus).toBe(row)
  expect(result.upcoming).toEqual([])
})


it('releases personal mode after standalone work ends while retaining history and days off', () => {
  const now = new Date('2026-10-02T12:00:00Z')
  const workspace = { relationship: { status: 'active', timeZone: 'UTC' }, occurrences: [
    { id: 'done', state: 'completed', scheduledDate: '2026-10-01' },
    { id: 'missed', state: 'scheduled', scheduledDate: '2026-10-01' },
    { id: 'abandoned', state: 'started', displayState: 'abandoned', scheduledDate: '2026-10-02' },
    { id: 'off', state: 'canceled', cancellationReason: 'explicit', scheduledDate: '2026-10-03' }
  ] }
  expect(hasActiveCoachPlan(workspace, now)).toBe(false)
  expect(ownAssignmentSchedule(workspace, now).past.map(row => row.id)).toEqual(['missed', 'done'])
  expect(ownAssignmentSchedule(workspace, now).canceled.map(row => row.id)).toEqual(['off'])
  workspace.occurrences.push({ id: 'pending', state: 'started', scheduledDate: '2026-10-01' })
  expect(hasActiveCoachPlan(workspace, now)).toBe(true)
})
