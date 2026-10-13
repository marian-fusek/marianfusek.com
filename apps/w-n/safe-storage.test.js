const test = require('node:test');
const assert = require('node:assert/strict');
const {setItemSafe} = require('./safe-storage.js');

test('safe storage reports a successful cache write', () => {
  const values = {};
  const storage = {setItem(key, value){ values[key] = value; }};
  assert.equal(setItemSafe(storage, 'week', 'cached'), true);
  assert.equal(values.week, 'cached');
});

test('safe storage absorbs quota failures without aborting refresh', () => {
  const storage = {setItem(){ throw new Error('QuotaExceededError'); }};
  assert.equal(setItemSafe(storage, 'projections', 'too-large'), false);
});
