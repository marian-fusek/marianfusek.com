const test = require('node:test');
const assert = require('node:assert/strict');
const {canRecordCompletedWeek} = require('./result-readiness.js');
const {needsResultRepair} = require('./result-readiness.js');

test('does not record a completed week when the stats feed is partial', () => {
  assert.equal(canRecordCompletedWeek({
    weekComplete: true,
    stats: {qb: {pts_ppr: 12}},
    rosterIds: ['qb', 'rb'],
    statsPartial: true
  }), false);
});

test('does not record a completed week when roster stat rows are missing', () => {
  assert.equal(canRecordCompletedWeek({
    weekComplete: true,
    stats: {},
    rosterIds: ['qb', 'rb'],
    statsPartial: false
  }), false);
});

test('records a completed week when every rostered player has stats', () => {
  assert.equal(canRecordCompletedWeek({
    weekComplete: true,
    stats: {qb: {pts_ppr: 12}, rb: {pts_ppr: 8}},
    rosterIds: ['qb', 'rb'],
    statsPartial: false
  }), true);
});

test('marks only a saved zero-zero result for repair', () => {
  assert.equal(needsResultRepair({aScore: 0, bScore: 0}), true);
  assert.equal(needsResultRepair({aScore: 12, bScore: 0}), false);
  assert.equal(needsResultRepair({aScore: 0, bScore: 8}), false);
});
