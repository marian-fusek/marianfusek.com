const test = require('node:test');
const assert = require('node:assert/strict');
const {canChangeRoster} = require('./roster-policy.js');

test('an open week allows adding a player whose game already finished', () => {
  assert.equal(canChangeRoster({weekComplete:false, playerStarted:true, playerOwned:false}), true);
});

test('an open week allows moving an already-rostered player after kickoff', () => {
  assert.equal(canChangeRoster({weekComplete:false, playerStarted:true, playerOwned:true}), true);
});

test('a completed week remains locked for every roster action', () => {
  assert.equal(canChangeRoster({weekComplete:true, playerStarted:false, playerOwned:false}), false);
  assert.equal(canChangeRoster({weekComplete:true, playerStarted:true, playerOwned:true}), false);
});
