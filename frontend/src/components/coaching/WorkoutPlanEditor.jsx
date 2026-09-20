import { useState } from 'react'
import { Button } from '../ui.jsx'
import Icon from '../Icon.jsx'
import ExerciseCatalogPicker from '../ExerciseCatalogPicker.jsx'
import { isCardio } from '../../lib/exercises.js'

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const targetFor = mode => mode === 'time' ? { seconds: 45, weight: 0 } : mode === 'cardio' ? { minutes: 20, speed: 0 } : { reps: 8, weight: 0 }
const newExercise = () => ({ entryId: crypto.randomUUID(), exerciseId: crypto.randomUUID(), name: 'New exercise', mode: 'reps', sets: [targetFor('reps')], restSec: 90, notes: '', custom: { muscle: '', equipment: '' } })
const catalogExercise = exercise => ({ entryId: crypto.randomUUID(), exerciseId: exercise.id, name: exercise.n, mode: isCardio(exercise) ? 'cardio' : 'reps', sets: [targetFor(isCardio(exercise) ? 'cardio' : 'reps')], restSec: 90, notes: '' })
const newDay = index => ({ id: crypto.randomUUID(), name: `Day ${index + 1}`, weekdays: [Math.min(7, index + 1)], exercises: [] })

export const emptyWorkout = () => ({ name: 'Weekly strength plan', unit: 'kg', days: [newDay(0)] })

export default function WorkoutPlanEditor({ value, onChange, singleDay = false }) {
  const [addingDay, setAddingDay] = useState(null)
  const update = (path, next) => {
    const copy = structuredClone(value)
    let at = copy
    for (let index = 0; index < path.length - 1; index += 1) at = at[path[index]]
    at[path.at(-1)] = next
    onChange(copy)
  }
  const updateExercise = (dayIndex, exerciseIndex, changes) => {
    const copy = structuredClone(value)
    Object.assign(copy.days[dayIndex].exercises[exerciseIndex], changes)
    onChange(copy)
  }
  const addExercise = (dayIndex, exercise) => {
    update(['days', dayIndex, 'exercises'], [...value.days[dayIndex].exercises, exercise])
    setAddingDay(null)
  }
  const moveExercise = (dayIndex, exerciseIndex, offset) => {
    const copy = structuredClone(value)
    const exercises = copy.days[dayIndex].exercises
    const next = exerciseIndex + offset
    if (next < 0 || next >= exercises.length) return
    ;[exercises[exerciseIndex], exercises[next]] = [exercises[next], exercises[exerciseIndex]]
    onChange(copy)
  }
  const changeMode = (dayIndex, exerciseIndex, mode) => {
    const exercise = value.days[dayIndex].exercises[exerciseIndex]
    updateExercise(dayIndex, exerciseIndex, { mode, sets: exercise.sets.map(() => targetFor(mode)) })
  }
  const setTarget = (dayIndex, exerciseIndex, field, raw) => {
    const exercise = value.days[dayIndex].exercises[exerciseIndex]
    updateExercise(dayIndex, exerciseIndex, { sets: exercise.sets.map(set => ({ ...set, [field]: Math.max(0, Number(raw) || 0) })) })
  }

  return <div className="coaching-editor">
    {!singleDay && <label><span>Plan name</span><input value={value.name} onChange={event => update(['name'], event.target.value)} /></label>}
    <label><span>Weight unit</span><select value={value.unit} onChange={event => update(['unit'], event.target.value)}><option value="kg">kg</option><option value="lb">lb</option></select></label>
    {value.days.map((day, dayIndex) => {
      const claimedElsewhere = new Set(value.days.filter((_, index) => index !== dayIndex).flatMap(item => item.weekdays))
      return <section key={day.id} className="coaching-editor-day">
        <div className="coaching-editor-heading">
          <label><span>{singleDay ? 'Workout name' : 'Day name'}</span><input aria-label={singleDay ? 'Workout name' : 'Day name'} value={day.name} onChange={event => update(['days', dayIndex, 'name'], event.target.value)} /></label>
          {!singleDay && value.days.length > 1 && <Button type="button" onClick={() => update(['days'], value.days.filter(item => item.id !== day.id))}>Remove day</Button>}
        </div>
        {!singleDay && <div className="coaching-weekdays">{weekdays.map((label, index) => {
          const weekday = index + 1
          const disabled = claimedElsewhere.has(weekday) && !day.weekdays.includes(weekday)
          return <button type="button" disabled={disabled} title={disabled ? 'Already used by another training day' : ''} className={day.weekdays.includes(weekday) ? 'on' : ''} key={label} onClick={() => update(['days', dayIndex, 'weekdays'], day.weekdays.includes(weekday) ? day.weekdays.filter(item => item !== weekday) : [...day.weekdays, weekday].sort())}>{label}</button>
        })}</div>}
        {day.exercises.map((exercise, exerciseIndex) => <div className="coaching-exercise" key={exercise.entryId || exercise.id}>
          <div className="coaching-exercise-title">
            <div><strong>{exercise.name}</strong><small>{exercise.custom ? 'Manual exercise' : 'Exercise catalog'}</small></div>
            <div><button type="button" aria-label="Move exercise up" disabled={exerciseIndex === 0} onClick={() => moveExercise(dayIndex, exerciseIndex, -1)}><Icon name="chevronUp" /></button><button type="button" aria-label="Move exercise down" disabled={exerciseIndex === day.exercises.length - 1} onClick={() => moveExercise(dayIndex, exerciseIndex, 1)}><Icon name="chevronDown" /></button><button type="button" onClick={() => update(['days', dayIndex, 'exercises'], day.exercises.filter((_, index) => index !== exerciseIndex))}>Remove</button></div>
          </div>
          {exercise.custom && <><label><span>Exercise name</span><input value={exercise.name} onChange={event => updateExercise(dayIndex, exerciseIndex, { name: event.target.value })} /></label><label><span>Muscle / type</span><input value={exercise.custom.muscle || ''} onChange={event => updateExercise(dayIndex, exerciseIndex, { custom: { ...exercise.custom, muscle: event.target.value } })} /></label><label><span>Equipment</span><input value={exercise.custom.equipment || ''} onChange={event => updateExercise(dayIndex, exerciseIndex, { custom: { ...exercise.custom, equipment: event.target.value } })} /></label></>}
          <label><span>Target type</span><select value={exercise.mode} onChange={event => changeMode(dayIndex, exerciseIndex, event.target.value)}><option value="reps">Reps</option><option value="time">Timed</option><option value="cardio">Cardio</option></select></label>
          <label><span>Sets</span><input type="number" min="1" max="20" value={exercise.sets.length} onChange={event => updateExercise(dayIndex, exerciseIndex, { sets: Array.from({ length: Math.max(1, Math.min(20, Number(event.target.value) || 1)) }, (_, index) => exercise.sets[index] || targetFor(exercise.mode)) })} /></label>
          {exercise.mode === 'reps' && <><label><span>Reps per set</span><input type="number" min="0" value={exercise.sets[0]?.reps || 0} onChange={event => setTarget(dayIndex, exerciseIndex, 'reps', event.target.value)} /></label><label><span>Weight</span><input type="number" min="0" step="0.5" value={exercise.sets[0]?.weight || 0} onChange={event => setTarget(dayIndex, exerciseIndex, 'weight', event.target.value)} /></label></>}
          {exercise.mode === 'time' && <label><span>Seconds per set</span><input type="number" min="0" value={exercise.sets[0]?.seconds || 0} onChange={event => setTarget(dayIndex, exerciseIndex, 'seconds', event.target.value)} /></label>}
          {exercise.mode === 'cardio' && <label><span>Minutes per set</span><input type="number" min="0" value={exercise.sets[0]?.minutes || 0} onChange={event => setTarget(dayIndex, exerciseIndex, 'minutes', event.target.value)} /></label>}
          <label><span>Rest, seconds</span><input type="number" min="0" value={exercise.restSec || 0} onChange={event => updateExercise(dayIndex, exerciseIndex, { restSec: Math.max(0, Number(event.target.value) || 0) })} /></label>
          <label className="coaching-exercise-notes"><span>Coach notes</span><textarea rows="2" value={exercise.notes || ''} onChange={event => updateExercise(dayIndex, exerciseIndex, { notes: event.target.value })} /></label>
        </div>)}
        {addingDay === dayIndex ? <div className="coaching-catalog"><div className="row between"><h3>Choose an exercise</h3><Button type="button" onClick={() => setAddingDay(null)}>Close</Button></div><ExerciseCatalogPicker onPick={exercise => addExercise(dayIndex, catalogExercise(exercise))} onManual={() => addExercise(dayIndex, newExercise())} /></div> : <Button type="button" icon="plus" onClick={() => setAddingDay(dayIndex)}>Add exercise</Button>}
      </section>
    })}
    {!singleDay && <Button type="button" icon="plus" onClick={() => update(['days'], [...value.days, newDay(value.days.length)])}>Add training day</Button>}
  </div>
}
