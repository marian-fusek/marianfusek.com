const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeRivalry, buildPlayerScoreSnapshot } = require('./rivalry-utils.js');

const teams = [
  { id: 'a', name: 'Bad Eggs' },
  { id: 'b', name: 'Crow Bros' }
];

const results = {
  1: {
    aScore: 110,
    bScore: 108,
    winner: 'a',
    playerScores: [
      { id: 'p1', teamId: 'a', points: 30 },
      { id: 'p2', teamId: 'a', points: 25 },
      { id: 'p3', teamId: 'b', points: 24 },
      { id: 'missing', teamId: 'b', points: 11 }
    ]
  },
  2: { aScore: 0, bScore: 0, winner: 'tie' },
  4: {
    aScore: 90,
    bScore: 120,
    winner: 'b',
    playerScores: [
      { id: 'p1', teamId: 'a', points: 15 },
      { id: 'p4', teamId: 'b', points: 40 }
    ]
  },
  8: null
};

test('summarizes recorded results without counting unplayed weeks', () => {
  const summary = summarizeRivalry({ teams, results, playerById: {
    p1: { name: 'Player One', position: 'WR', team: 'SEA' },
    p2: { name: 'Player Two', position: 'RB', team: 'TB' },
    p3: { name: 'Player Three', position: 'QB', team: 'ATL' },
    p4: { name: 'Player Four', position: 'TE', team: 'MIN' }
  }});

  assert.deepEqual(summary.records.a, { wins: 1, losses: 1, ties: 1, pointsFor: 200, pointsAgainst: 228 });
  assert.deepEqual(summary.records.b, { wins: 1, losses: 1, ties: 1, pointsFor: 228, pointsAgainst: 200 });
  assert.equal(summary.weeklyResults.length, 3);
  assert.equal(summary.weeklyResults.some(result => result.week === 8), false);
  assert.equal(summary.funStats.biggestWin.week, 4);
  assert.equal(summary.funStats.biggestWin.margin, 30);
  assert.equal(summary.funStats.closestMatchup.week, 1);
  assert.equal(summary.funStats.highestCombined.week, 1);
});

test('aggregates top scorers across saved player snapshots and falls back for missing metadata', () => {
  const summary = summarizeRivalry({ teams, results, playerById: {
    p1: { name: 'Player One', position: 'WR', team: 'SEA' },
    p2: { name: 'Player Two', position: 'RB', team: 'TB' },
    p3: { name: 'Player Three', position: 'QB', team: 'ATL' },
    p4: { name: 'Player Four', position: 'TE', team: 'MIN' }
  }});

  assert.equal(summary.topScorers[0].id, 'p1');
  assert.equal(summary.topScorers[0].total, 45);
  assert.equal(summary.topScorers[0].best, 30);
  assert.equal(summary.topScorers.at(-1).name, 'Player missing');
});

test('keeps a recorded 0–0 tie in the season record', () => {
  const summary = summarizeRivalry({ teams, results: { 2: results[2] } });
  assert.equal(summary.records.a.ties, 1);
  assert.equal(summary.records.b.ties, 1);
  assert.equal(summary.weeklyResults[0].score, '0–0');
});

test('builds a compact score snapshot for every filled starter slot', () => {
  const snapshot = buildPlayerScoreSnapshot({
    teams: [
      { id: 'a', name: 'Bad Eggs', roster: { QB: 'p1', RB1: 'p2' } },
      { id: 'b', name: 'Crow Bros', roster: { QB: 'p3' } }
    ],
    starterSlots: ['QB', 'RB1', 'RB2'],
    playerById: {
      p1: { name: 'Player One', position: 'QB', team: 'SEA' },
      p2: { name: 'Player Two', position: 'RB', team: 'TB' },
      p3: { name: 'Player Three', position: 'QB', team: 'ATL' }
    },
    scoreFor: id => ({p1: 21.5, p2: 8, p3: 17}[id])
  });

  assert.deepEqual(snapshot, [
    { id: 'p1', teamId: 'a', teamName: 'Bad Eggs', name: 'Player One', position: 'QB', team: 'SEA', points: 21.5 },
    { id: 'p2', teamId: 'a', teamName: 'Bad Eggs', name: 'Player Two', position: 'RB', team: 'TB', points: 8 },
    { id: 'p3', teamId: 'b', teamName: 'Crow Bros', name: 'Player Three', position: 'QB', team: 'ATL', points: 17 }
  ]);
});
