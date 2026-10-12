const test = require('node:test');
const assert = require('node:assert/strict');
const {
  clampWeek,
  targetWeek,
  requestWeek
} = require('./week-navigation.js');

test('week navigation stays inside the regular season', () => {
  assert.equal(clampWeek(0), 1);
  assert.equal(clampWeek(19), 18);
  assert.equal(targetWeek(4, 'next'), 5);
  assert.equal(targetWeek(4, 'prev'), 3);
});

test('a second navigation request is ignored while the first is loading', () => {
  assert.deepEqual(requestWeek(6, 'next', false), { accepted: true, week: 7 });
  assert.deepEqual(requestWeek(6, 'next', true), { accepted: false, week: 6 });
});
