const test = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldLockWeek,
  visibleResult
} = require('./week-lock.js');

test('an in-progress schedule overrides a stale saved result', () => {
  const result = {aScore: 80, bScore: 70, winner: 'a'};
  const schedule = [{state: 'pre'}, {state: 'post'}];

  assert.equal(shouldLockWeek({result, schedule}), false);
  assert.equal(visibleResult({result, schedule}), null);
});

test('a fully final schedule locks the week and keeps its result', () => {
  const result = {aScore: 80, bScore: 70, winner: 'a'};
  const schedule = [{state: 'post'}, {state: 'completed'}];

  assert.equal(shouldLockWeek({result, schedule}), true);
  assert.deepEqual(visibleResult({result, schedule}), result);
});

test('a saved result is the fallback when no schedule is available', () => {
  const result = {aScore: 80, bScore: 70, winner: 'a'};

  assert.equal(shouldLockWeek({result, schedule: []}), true);
  assert.deepEqual(visibleResult({result, schedule: []}), result);
});
