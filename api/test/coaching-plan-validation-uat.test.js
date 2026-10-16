import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkoutContent } from '../coaching/plans.js';

const valid = () => ({ name: 'Strength', unit: 'kg', days: [{ id: 'day', name: 'Squat day', weekdays: [1], exercises: [{ entryId: 'entry', exerciseId: 'squat', name: 'Goblet squat', mode: 'reps', sets: [{ reps: 8, weight: 20 }] }] }] });

test('invalid workout drafts cannot silently become a published default plan', () => {
  for (const mutate of [
    plan => { plan.name = ''; },
    plan => { plan.name = '   '; },
    plan => { plan.days[0].name = ''; },
    plan => { plan.days[0].exercises = []; },
    plan => { plan.days[0].exercises[0].name = ''; },
    plan => { plan.days[0].exercises[0].sets = []; },
    plan => { plan.days[0].exercises[0].sets[0].weight = -1; },
    plan => { plan.days.push({ ...structuredClone(plan.days[0]), id: 'other' }); }
  ]) {
    const plan = valid(); mutate(plan);
    assert.throws(() => validateWorkoutContent(plan), error => error.status === 422 && error.code === 'VALIDATION_ERROR');
  }
  assert.equal(validateWorkoutContent(valid()).name, 'Strength');
});
