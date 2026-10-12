const test = require('node:test');
const assert = require('node:assert/strict');
const {
  shouldUsePlayerCache,
  refreshCompletionLabel
} = require('./refresh-helpers.js');

test('manual refresh keeps a fresh player cache instead of refetching the huge catalog', () => {
  assert.equal(shouldUsePlayerCache({ts: 90_000, players: [{id:'1'}]}, 100_000, 86_400_000), true);
  assert.equal(shouldUsePlayerCache({ts: 0, players: [{id:'1'}]}, 90_000_000, 86_400_000), false);
});

test('partial feed refresh is reported as cached data, not a total failure', () => {
  assert.equal(refreshCompletionLabel({partial:true}), 'Updated with cached data');
  assert.equal(refreshCompletionLabel({partial:false}), 'Updated just now');
});
