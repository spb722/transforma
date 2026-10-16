export function assignedWorkoutFromSnapshot(sessionId,snapshot){return {id:sessionId,assignedSessionId:sessionId,assignedPrescription:structuredClone(snapshot),unit:snapshot.unit,entries:(snapshot.exercises||[]).map(exercise=>({id:exercise.exerciseId||exercise.id,entryId:exercise.entryId||exercise.id,name:exercise.name,target:{...exercise,weight:exercise.sets?.[0]?.weight||0,reps:exercise.sets?.[0]?.reps||0,sec:exercise.sets?.[0]?.seconds||0,min:exercise.sets?.[0]?.minutes||0},sets:(exercise.sets||[]).map(set=>({w:set.weight||0,r:set.reps||0,sec:set.seconds||0,min:set.minutes||0,speed:set.speed||0,done:false}))}))}}
export function resultPayload(active,clientFinishedAt=new Date().toISOString()){return {sessionId:active.assignedSessionId||active.id,state:'finished',clientFinishedAt,actualWorkout:{id:active.id,unit:active.unit,entries:active.entries}}}

export function assignedTargetLabel(exercise, set, unit) {
 if (exercise.mode === 'cardio') return `${set.minutes || 0} min @ ${set.speed || 0} km/h`
 if (exercise.mode === 'time') return `${set.seconds || 0}s${set.weight ? ` · ${set.weight} ${unit}` : ''}`
 return `${set.weight || 0} ${unit} × ${set.reps || 0} reps`
}

export function workoutInUnit(workout, unit) {
 const source = workout.assignedPrescription?.unit || workout.unit || unit
 if (source === unit) return workout
 const factor = source === 'lb' ? 0.45359237 : 1 / 0.45359237
 return { ...workout, entries: workout.entries.map(entry => ({ ...entry,
  topW: entry.topW == null ? entry.topW : entry.topW * factor,
  sets: entry.sets.map(set => ({ ...set, ...(set.w == null ? {} : { w: set.w * factor }) }))
 })) }
}

// Resume the same device-local workout without rebuilding its logged sets.
export function assignedWorkoutResume(active, occurrence) {
 if (active) {
  if (active.assignedSessionId && active.occurrenceId === occurrence.id) return active
  throw new Error('Finish or discard your current workout before starting another workout.')
 }
 if (!['scheduled', 'started'].includes(occurrence.state) || ['abandoned', 'completed', 'partial', 'zero'].includes(occurrence.displayState || occurrence.day?.state)) {
  throw new Error('This workout has ended. Refresh your schedule to see its result.')
 }
 return null
}
