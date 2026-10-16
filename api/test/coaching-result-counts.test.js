import test from 'node:test';
import assert from 'node:assert/strict';
import { completedOccurrenceCount } from '../coaching/result-counts.js';

test('zero and zero-extra attempts do not count completed, partial results count once', () => {
  const row = (id, completedSets, classification) => ({ occurrence_id: id, summary_json: JSON.stringify({ completedSets, classification }) });
  assert.equal(completedOccurrenceCount([
    row('zero', 0, 'zero'), row('zero', 0, 'extra'),
    row('partial', 1, 'partial'), row('partial', 2, 'extra'), row('full', 5, 'completed')
  ]), 2);
});

test('legacy results use actual done sets and ignore unfinished sets', () => {
  const row = (id, sets) => ({ occurrence_id: id, summary_json: '{}', actual_json: JSON.stringify({ entries: [{ sets }] }) });
  assert.equal(completedOccurrenceCount([row('empty', []), row('skipped', [{ done: false }]), row('legacy', [{ done: true }, { done: false }])]), 1);
});
