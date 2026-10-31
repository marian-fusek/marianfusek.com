# Rivalry tab design

## Intent

Add a fourth primary view, `Rivalry`, that makes the private two-person league feel like an ongoing contest rather than only a current-week scoreboard. It should show the two teams' shared record, saved weekly results, individual top scorers, and a few playful but defensible comparisons.

## Goals

- Make the head-to-head record and points-for/against immediately scannable.
- Show saved weekly results with ties, winners, and exact scores.
- Show top individual starter scorers from recorded weeks.
- Add three derived rivalry facts: biggest win, closest matchup, and highest combined score.
- Keep the view accurate when no completed result or player-score snapshot exists.
- Use the existing off-white / ink / restrained-accent visual system and work on narrow mobile screens.

## Non-goals

- No new accounts, commissioner features, trades, chat, or live-score dashboard.
- No projections counted as results.
- No raw NFL stats stored in Supabase. Only derived weekly result data that belongs to What's Nest may be saved.
- No fabricated `0–0` rows for weeks that have not been recorded.

## Approach

The app will reuse the existing `state.results` records and `seasonRecord()` logic. When a fully final week is recorded, the result will also keep a compact `playerScores` snapshot for the nine starters in that week. The Rivalry view will derive all cards from those result snapshots, current team names/logos, and existing result data. This keeps the feature shared between both browsers without adding a provider fetch or a second scoring path.

Top scorers means the highest individual starter PPR scores found in recorded result snapshots. A week that has no snapshot remains usable in the weekly results list but cannot contribute to the individual leaderboard; the UI will say that plainly. Fun stats use only complete saved results: biggest margin, closest non-tie margin, and highest combined score.

## UX / visual direction

- Primary navigation label: `Rivalry`.
- Intro: `The season, in receipts.` with a short dry line about keeping score.
- First dark panel: two team identities, W–L–T records, and points for/against.
- Below: compact rivalry facts, top scorers, then a weekly results timeline.
- Empty states explain what data is missing without displaying fake numbers.
- Keep the layout a calm editorial dashboard: generous space, oversized headline, small labels, no sports-broadcast clutter.

## Acceptance criteria

- Clicking `Rivalry` hides other views and renders the current shared team names/logos.
- Existing results still render if they have no `playerScores` field.
- A newly recorded final week stores starter player score snapshots and the Rivalry view includes them in top scorers.
- Unplayed weeks do not affect record, fun stats, or top scorers.
- The view is usable at mobile width with no horizontal overflow.
