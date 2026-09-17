# Fantasheee feature status

This is the live implementation checklist for the Fantasheee build.

## Current rollup

- App/UI and local preview: 95%
- ESPN team + starter/bench mirror: 90% — the browser can request the read-only feed directly from the allowlisted Fantasheee origins; the existing feed also normalizes team records, waiver priority, matchup totals and transaction rows where ESPN exposes them.
- ESPN watch-mirror completeness: 70% — the current source is read-only and covers the league teams, rosters, lineups, records, matchups, settings and available activity fields; ESPN does not expose every score/projection/activity surface consistently.
- Overall build: 82% — the remaining work is deploying the approved ESPN read path and completing the data-source handoff, not another UI rewrite.

## Features

| Feature | Status | Notes |
| --- | --- | --- |
| Local preview and loading behavior | DONE | Served over HTTP; direct `file://` opening is not supported by the ES-module entry point; the brand button returns to the default Matchup view, loading/retry feedback covers both the app shell and team picker, automatic refresh pauses offline, cross-tab local updates remain supported, malformed storage can be recovered, and an unavailable live feed is explicitly labeled when local preview data is being shown. |
| Read-only mode and refresh feedback | DONE | Add/drop, waiver, trade, lineup-move and local waiver-processing paths are removed from the app; player sheets are informational only, the live source remains authoritative, pull-down refresh is wired at the top of the page, and the latest successful refresh time is visible. |
| Compact responsive team-picker | DONE | Fixed the vertical-stretch class collision and tightened the composition. |
| Six-team configuration and logo slots | DONE | Local fallback supports six teams and marks; live team names, abbreviations and logos are now taken from the existing ESPN-backed Sheeesh feed instead of guessed placeholders. |
| Exact ESPN teams, lineups and roster shape | READY | `js/espn-provider.js` normalizes the existing Sheeesh payload into Fantasheee team, roster and lineup state, including real starter/bench slots, logos, player positions, injury state, NFL game status and ESPN-provided roster slot counts when available. It can now use the allowlisted passwordless read path from Fantasheee itself. |
| Local demo roster and lineup state | OUT OF SCOPE | Demo seeding and synthetic player identities were removed from the watch build. Existing stale local state is not displayed while the approved ESPN read path is active. |
| Matchup score and projection presentation | DONE | Matchup shows current points, projected totals, explicit LIVE/FINAL/UPCOMING state, and a reversible opponent tab without leaking sheet state. |
| Team lineup management | DONE | Starter/bench sections, slot-capacity counts and explicit empty starter/bench slots are displayed from the current source. The app exposes no lineup mutation controls. |
| NFL player pool, search, filters, and player detail sheet | DONE | Live player metadata remains preferred; ESPN roster players are supplemented only with provider fields when available, non-active injury status carries through all player contexts, and Escape closes the detail sheet. |
| Free-agent add/drop and rolling waivers | OUT OF SCOPE | No add, drop, trade, claim or waiver-submission controls are exposed. Current waiver order, pending claims and activity are display-only source data. |
| Individual NFL kickoff locking | DONE | One shared lock rule labels live/final players across player rows, roster rows and detail sheets. |
| League waiver order and transaction history | DONE | Six-team waiver order, pending-waiver surface, recent-moves surface and live counts/timestamps are display-only; the app never processes or writes transactions. |
| Mobile-first visual system and desktop expansion | IN PROGRESS | Shared focus states, page-width constraints, desktop two-column Matchup/Team/League compositions, canonical lineup ordering, compact transaction feedback, overflow protection, async status/retry feedback, and navigation/tab accessibility state are live; final surface refinement remains. |
| Responsive QA at 320px, 390px, and desktop | IN PROGRESS | Desktop Matchup, Team, and League layouts plus explicit empty lineup slots are verified; narrow player rows and transaction controls preserve name/action space, but embedded preview does not honor explicit 320/390 viewport overrides, so phone-width QA remains for local browser testing. |
| ESPN mirror connection | READY | Uses the existing Supabase function URL and publishable key from the allowlisted Fantasheee origins without exposing ESPN cookies; the normal same-browser Sheeesh session remains supported. If the deployed function is still on the previous version, the app reports that connection failure and keeps local preview separate. |
| Supabase-ready shared league mode | OUT OF SCOPE | Fantasheee reads the ESPN source directly; no separate editable Supabase league state is exposed. |
| Production handoff for `marianfusek.com/fantasheee` | IN PROGRESS | Fantasheee client config is ready; deploy the updated existing `sheeesh` function before testing the live mirror locally or at the production path. |

## Remaining implementation inputs

- Deploy/currently maintain the updated Sheeesh Supabase function and its ESPN secrets so the passwordless Fantasheee read path is live locally and at `/fantasheee/`.
- Keep Fantasheee read-only; no server-side transaction adapter is planned.
- Extend the ESPN response deliberately for fantasy totals, projections, matchup schedule, waiver order and transactions if those must also be authoritative. The current function already provides the exact six teams and lineups, but not every league surface.
