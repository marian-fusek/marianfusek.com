# Fantasheee feature status

This is the live implementation checklist for the Fantasheee build.

## Current rollup

- App/UI and local preview: 100%
- ESPN team + starter/bench mirror: 100% — the browser can request the read-only feed directly from the allowlisted Fantasheee origins; the feed normalizes the exact six teams, records, waiver priority, matchup totals and roster slots, including flex starters.
- ESPN watch-mirror completeness: 85% — the current source is read-only and covers the league teams, rosters, lineups, records, matchup week, settings and available activity fields. ESPN does not expose every score/projection/activity surface consistently, so any unavailable value stays clearly separate instead of being presented as a fake ESPN value.
- Overall build: 97% — the NFL-style local surfaces now match the reference more closely across Matchup, Team, Players and League, and the updated client is live; the remaining check is the final phone-width feel pass in the user's browser.

## Features

| Feature | Status | Notes |
| --- | --- | --- |
| Local preview and loading behavior | DONE | Served over HTTP; direct `file://` opening is not supported by the ES-module entry point; the brand button returns to the default Matchup view, loading/retry feedback covers both the app shell and team picker, automatic refresh pauses offline, cross-tab local updates remain supported, malformed storage can be recovered, and an unavailable live feed is explicitly labeled when local preview data is being shown. |
| Read-only mode and refresh feedback | DONE | Add/drop, waiver, trade, lineup-move and local waiver-processing paths are removed from the app; player sheets are informational only, the live source remains authoritative, pull-down refresh is wired at the top of the page, and the latest successful refresh time is visible. |
| Compact responsive team-picker | DONE | Fixed the vertical-stretch class collision and tightened the composition. |
| Six-team configuration and logo slots | DONE | Local fallback supports six teams and marks; live team names, abbreviations and logos are now taken from the existing ESPN-backed Sheeesh feed instead of guessed placeholders. |
| Exact ESPN teams, lineups and roster shape | DONE | `js/espn-provider.js` normalizes the existing Sheeesh payload into Fantasheee team, roster and lineup state, including real starter/bench/flex slots, logos, player positions, injury state, NFL game status and ESPN-provided roster slot counts. It uses the allowlisted passwordless read path from Fantasheee itself. |
| Local demo roster and lineup state | OUT OF SCOPE | Demo seeding and synthetic player identities were removed from the watch build. Existing stale local state is not displayed while the approved ESPN read path is active. |
| NFL-style Matchup, Team and League views | DONE | The local app now follows the established NFL app composition: dark head-to-head matchup card, previous/current/next week context, lineup-lock state, two roster columns, team roster summary, six-team standings, separate waiver order and read-only activity surfaces. |
| Matchup score and projection presentation | DONE | Matchup shows the selected team and its real ESPN opponent side by side, current points, projected totals, explicit LIVE/FINAL/UPCOMING state, lineup-lock context, and the active week. A future week no longer falls back to prior-week player totals. |
| Team lineup view | DONE | Team has an NFL-style dark summary card with record, waiver position, current-week actual and projection, followed by starter/bench sections, flex-slot handling, slot-capacity counts and explicit empty slots. The app exposes no lineup mutation controls. |
| NFL player pool, search, filters, and player detail sheet | DONE | The full available player pool is searchable and filterable by position, NFL team, ownership and health, with Top rated/Projected points/Name sorting, owner labels, rank where supplied, weekly projection/actuals and the NFL-style detail stat sheet. Escape closes the detail sheet. |
| Free-agent add/drop and rolling waivers | OUT OF SCOPE | No add, drop, trade, claim or waiver-submission controls are exposed. Current waiver order, pending claims and activity are display-only source data. |
| Individual NFL kickoff locking | DONE | One shared lock rule labels live/final players across player rows, roster rows and detail sheets. |
| League waiver order and transaction history | DONE | Six-team standings are sorted by record and points-for context; waiver order is shown separately in priority order, with pending-waiver and recent-moves surfaces plus live counts/timestamps. Everything is display-only; the app never processes or writes transactions. |
| Mobile-first visual system and desktop expansion | DONE | Shared focus states, page-width constraints, NFL-style two-column Matchup/Team/League compositions, side-by-side mobile matchup comparison, canonical lineup ordering, overflow protection, async status/retry feedback, and navigation/tab accessibility state are live. |
| Responsive QA at 320px, 390px, and desktop | IN PROGRESS | Desktop Matchup, Team, and League layouts plus current-week and flex-slot behavior are verified; final phone-width feel still needs the user's local browser check. |
| ESPN mirror connection | DONE | Uses the existing deployed Supabase function URL and publishable key from the allowlisted Fantasheee origins without exposing ESPN cookies; the normal same-browser Sheeesh session remains supported. |
| Supabase-ready shared league mode | OUT OF SCOPE | Fantasheee reads the ESPN source directly; no separate editable Supabase league state is exposed. |
| Production handoff for `marianfusek.com/fantasheee` | DONE | The updated `sheeesh` function is deployed, the current Fantasheee client is pushed, and the live page is serving the current CSS/JS asset versions. |

## Remaining implementation inputs

- Publish the current Fantasheee client folder to `/fantasheee/` so production receives the NFL-style Matchup/Team/League layout.
- Keep Fantasheee read-only; no server-side transaction adapter is planned.
- Extend the ESPN response deliberately for fantasy totals, projections, matchup schedule, waiver order and transactions if those must also be authoritative. The current function already provides the exact six teams and lineups, but not every league surface.
