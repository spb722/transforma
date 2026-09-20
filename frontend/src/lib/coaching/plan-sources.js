import { EXIDX, isCardio } from '../exercises.js'
import { starterRoutines } from '../starter.js'

const freshId = () => crypto.randomUUID()
const isoWeekday = value => Number(value) === 0 ? 7 : Number(value)

function convertExercise(config, state, unit) {
  const catalog = EXIDX[config.id]
  const custom = (state.customEx || []).find(item => item.id === config.id)
  const mode = isCardio(catalog || custom || config.id) ? 'cardio' : config.mode === 'time' ? 'time' : 'reps'
  const count = Math.max(1, Math.min(20, Number(config.sets) || 1))
  const target = mode === 'cardio'
    ? { minutes: Math.max(0, Number(config.min) || 20), speed: Math.max(0, Number(config.speed) || 0) }
    : mode === 'time'
      ? { seconds: Math.max(0, Number(config.sec) || 45), weight: Math.max(0, Number(config.weight) || 0) }
      : { reps: Math.max(0, Number(config.reps) || 8), weight: Math.max(0, Number(config.weight) || 0) }
  return {
    entryId: freshId(),
    exerciseId: String(config.id),
    name: catalog?.n || custom?.n || config.name || 'Custom exercise',
    mode,
    sets: Array.from({ length: count }, () => ({ ...target })),
    restSec: Math.max(0, Number(config.restSec ?? state.restSec) || 0),
    notes: String(config.notes || '').slice(0, 500),
    ...(!catalog ? { custom: { muscle: custom?.tg || custom?.bp || '', equipment: custom?.eq || '' } } : {}),
    unit
  }
}

export function personalPlanSource(state) {
  const days = (state.routines || []).map(routine => {
    const weekdays = Object.entries(state.week || {}).filter(([, routineId]) => routineId === routine.id).map(([day]) => isoWeekday(day)).sort()
    if (!weekdays.length) return null
    return { id: freshId(), name: routine.name, weekdays, exercises: (routine.ex || []).map(config => convertExercise(config, state, state.unit || 'kg')) }
  }).filter(Boolean)
  return { name: 'My personal plan', unit: state.unit || 'kg', days }
}

export function starterPlanSource({ unit = 'kg', restSec = 90 } = {}) {
  const routines = starterRoutines()
  return { ...personalPlanSource({ unit, restSec, customEx: [], routines, week: { 1: routines[0].id, 3: routines[1].id, 5: routines[2].id } }), name: 'Starter PPL' }
}

export function normalizeWorkoutDraft(value) {
  if (!value?.days) return value
  return {
    ...structuredClone(value),
    days: value.days.map(day => ({ ...day, exercises: (day.exercises || []).map(exercise => ({
      ...exercise,
      entryId: exercise.entryId || exercise.id || freshId(),
      exerciseId: exercise.exerciseId || exercise.id || freshId(),
      id: undefined
    })) }))
  }
}
