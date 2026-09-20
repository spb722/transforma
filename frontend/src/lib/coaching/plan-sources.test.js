import { describe, expect, it } from 'vitest'
import { normalizeWorkoutDraft, personalPlanSource, starterPlanSource } from './plan-sources.js'

describe('trainer plan source converters', () => {
  it('maps JavaScript Sunday to ISO Sunday and keeps catalog identity separate from entry identity', () => {
    const source = personalPlanSource({ unit: 'lb', restSec: 75, customEx: [], routines: [{ id: 'r1', name: 'Sunday', ex: [{ id: '0025', sets: 2, reps: 10, weight: 30 }] }], week: { 0: 'r1' } })
    expect(source.days[0].weekdays).toEqual([7])
    expect(source.days[0].exercises[0]).toMatchObject({ exerciseId: '0025', mode: 'reps', restSec: 75 })
    expect(source.days[0].exercises[0].entryId).not.toBe('0025')
    expect(source.days[0].exercises[0].sets).toHaveLength(2)
  })

  it('builds a Monday Wednesday Friday starter and normalizes legacy entries', () => {
    expect(starterPlanSource()).toMatchObject({ name: 'Starter PPL' })
    expect(starterPlanSource().days.map(day => day.weekdays[0])).toEqual([1, 3, 5])
    const normalized = normalizeWorkoutDraft({ name: 'Legacy', unit: 'kg', days: [{ id: 'd', weekdays: [1], exercises: [{ id: 'bench', name: 'Bench' }] }] })
    expect(normalized.days[0].exercises[0]).toMatchObject({ entryId: 'bench', exerciseId: 'bench' })
    expect(normalized.days[0].exercises[0].id).toBeUndefined()
  })
})
