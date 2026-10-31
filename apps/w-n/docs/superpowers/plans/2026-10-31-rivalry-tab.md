# Rivalry Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `Rivalry` tab with head-to-head records, weekly results, top individual scorers, and three derived fun stats.

**Architecture:** Keep the no-build static app. Add a pure `rivalry-utils.js` module for result aggregation and player-score ranking, save compact starter score snapshots inside completed `state.results` records, and render a fourth view in `app.js` with localized CSS in `styles.css`.

**Tech Stack:** Vanilla HTML, CSS, JavaScript, browser `node:test` modules, existing Supabase state sync.

**Spec:** `docs/superpowers/specs/2026-10-31-rivalry-tab-design.md`

## Global Constraints

- Keep exactly two fantasy teams and nine starter slots per team.
- Use existing weekly PPR scoring and never count projections as results.
- Keep unplayed weeks out of records and derived statistics.
- Store only What's Nest state in Supabase; do not add raw NFL stat storage.
- Preserve local-only mode, shared sync, weekly snapshots, and all existing views.
- Keep the existing restrained editorial visual direction and mobile behavior.

## Review Focus

- A historical result without `playerScores` must still render normally — test in Task 1.
- A tie and a zero-score-but-recorded result must not be treated as an unplayed week — test in Task 1.
- Duplicate player snapshots across weeks must aggregate correctly and keep the best score — test in Task 1.
- Missing player metadata must produce a readable fallback instead of breaking the tab — test in Task 1.
- A final-week redraft must overwrite its saved result snapshot rather than create a second weekly result — test in Task 2.

### Task 1: Rivalry aggregation utilities

**Files:**
- Create: `rivalry-utils.js`
- Create: `rivalry-utils.test.js`

**Interfaces:**
- Produces `summarizeRivalry({ teams, results, playerById })` returning `{ records, totals, funStats, topScorers, weeklyResults }`.
- `results[week]` may contain `aScore`, `bScore`, `winner`, `updatedAt`, and optional `playerScores` entries `{ id, teamId, name, position, points }`.

- [ ] **Step 1: Write failing tests** for records, PF/PA, ties, unplayed-week exclusion, fun stats, missing snapshots, and top-scorer aggregation.
- [ ] **Step 2: Run `node --test rivalry-utils.test.js` and verify the new tests fail for the expected missing-module reason.
- [ ] **Step 3: Implement pure aggregation functions in `rivalry-utils.js`** with no DOM, fetch, or storage dependencies.
- [ ] **Step 4: Run `node --test rivalry-utils.test.js` and verify all new tests pass.

### Task 2: Persist player score snapshots with completed results

**Files:**
- Modify: `app.js: recordCompletedWeek()` and result helpers.
- Modify: `result-readiness.test.js` or add a focused result snapshot test if a pure helper is extracted.

**Interfaces:**
- `recordCompletedWeek()` keeps the existing result shape and adds `playerScores` for the current nine starter slots, using `pointsFor()` and current player metadata.
- Re-recording the same week replaces the existing snapshot in `state.results[week]` and still performs one shared-state update.

- [ ] **Step 1: Add a failing test** for building a compact player-score snapshot from two teams’ starter rosters and stats.
- [ ] **Step 2: Run the focused test and verify it fails before the helper exists.
- [ ] **Step 3: Implement the snapshot helper and call it from `recordCompletedWeek()` without changing readiness rules.
- [ ] **Step 4: Run the focused result tests and the full existing test suite.

### Task 3: Add the Rivalry view and navigation

**Files:**
- Modify: `index.html` to add the `Rivalry` nav button and `view-rivalry` section.
- Modify: `app.js` to import/use the aggregation utility, render the view, and include it in `renderAll()`.
- Modify: `styles.css` with the Rivalry panel, facts, leaderboard, timeline, and mobile rules.

**Interfaces:**
- `renderRivalry()` reads only the current app state plus `summarizeRivalry()` output.
- The view renders live team names/logos, W–L–T, PF/PA, fun-stat cards, top scorer rows, and weekly result rows.

- [ ] **Step 1: Add the navigation/view shell and a failing smoke assertion** that the new view is rendered by `renderAll()` in the app fixture or source-level check.
- [ ] **Step 2: Implement the render markup and event wiring using existing `logo()`, `esc()`, `fmt()`, and result conventions.
- [ ] **Step 3: Add responsive CSS so the dark summary panel stacks cleanly and the timeline never overflows at mobile widths.
- [ ] **Step 4: Update the stylesheet/script cache-busting query strings in `index.html`.
- [ ] **Step 5: Run syntax checks, all Node tests, `git diff --check`, and the Impeccable detector once over the changed UI files.

### Task 4: Documentation and live smoke verification

**Files:**
- Modify: `README.md` to list and explain the Rivalry tab.

- [ ] **Step 1: Add the feature to the existing behavior list and explain that top scorers begin populating from newly recorded final weeks.
- [ ] **Step 2: Serve `apps/w-n` with the existing tiny local server and smoke-test Matchup, Rivalry, League, week switching, and mobile width.
- [ ] **Step 3: Verify shared-state reload does not erase the new tab or existing Week 8 rosters.
- [ ] **Step 4: Review the final diff and report the feature completion, next missing milestone, and any user action.
