import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { allExercises, BODYPARTS, equipmentOf } from '../lib/exercises.js'
import { Thumb } from './Media.jsx'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'

export default function ExerciseCatalogPicker({ onPick, onManual }) {
  const state = useStore(value => value.S)
  const [query, setQuery] = useState('')
  const [bodyPart, setBodyPart] = useState('')
  const [equipment, setEquipment] = useState('')
  const [shown, setShown] = useState(40)
  const usage = useMemo(() => {
    const counts = {}
    ;(state.routines || []).forEach(routine => (routine.ex || []).forEach(exercise => { counts[exercise.id] = (counts[exercise.id] || 0) + 1 }))
    ;(state.workouts || []).forEach(workout => (workout.entries || []).forEach(exercise => { counts[exercise.id] = (counts[exercise.id] || 0) + 1 }))
    return counts
  }, [state.routines, state.workouts])
  const exercises = allExercises(state)
  const filteredBySearch = useMemo(() => {
    const term = query.trim().toLowerCase()
    return exercises.filter(exercise => (bodyPart === '★' ? usage[exercise.id] : !bodyPart || exercise.bp === bodyPart) && (!term || [exercise.n, exercise.tg, exercise.eq, exercise.desc].some(value => String(value || '').toLowerCase().includes(term))))
  }, [exercises, query, bodyPart, usage])
  const equipmentOptions = equipmentOf(filteredBySearch)
  const activeEquipment = equipmentOptions.includes(equipment) ? equipment : ''
  const filtered = activeEquipment ? filteredBySearch.filter(exercise => exercise.eq === activeEquipment) : filteredBySearch

  return <div className="coaching-catalog-picker">
    <div className="search"><Icon name="search" /><input className="input" aria-label="Search exercises" placeholder={`Search ${exercises.length} exercises`} value={query} onChange={event => { setQuery(event.target.value); setShown(40) }} /></div>
    <div className="chips">{!!Object.keys(usage).length && <button type="button" className={'chip' + (bodyPart === '★' ? ' on' : '')} onClick={() => { setBodyPart('★'); setEquipment('') }}>Chosen</button>}<button type="button" className={'chip' + (!bodyPart ? ' on' : '')} onClick={() => { setBodyPart(''); setEquipment('') }}>All</button>{BODYPARTS.map(item => <button type="button" key={item} className={'chip' + (bodyPart === item ? ' on' : '')} onClick={() => { setBodyPart(item); setEquipment('') }}>{item}</button>)}</div>
    {equipmentOptions.length > 1 && <div className="chips"><button type="button" className={'chip' + (!activeEquipment ? ' on' : '')} onClick={() => setEquipment('')}>Any equipment</button>{equipmentOptions.map(item => <button type="button" key={item} className={'chip' + (activeEquipment === item ? ' on' : '')} onClick={() => setEquipment(item)}>{item}</button>)}</div>}
    <div className="list coaching-catalog-results">
      <button type="button" className="item" onClick={onManual}><span className="thumb thumb-x"><Icon name="plus" /></span><span className="grow"><span className="tt">Create manual exercise</span><span className="ss">Use when the catalog has no match</span></span></button>
      {filtered.slice(0, shown).map(exercise => <button type="button" className="item" key={exercise.id} onClick={() => onPick(exercise)}><Thumb ex={exercise} /><span className="grow"><span className="tt capitalize">{exercise.n}</span><span className="ss capitalize">{exercise.tg || exercise.bp} · {exercise.eq}</span></span>{usage[exercise.id] ? <Icon name="starFill" /> : <Icon name="plus" />}</button>)}
    </div>
    {filtered.length > shown && <Button type="button" onClick={() => setShown(value => value + 40)}>Show more</Button>}
  </div>
}
