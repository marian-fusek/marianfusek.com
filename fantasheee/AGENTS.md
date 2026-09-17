# AGENTS.md — Fantasheee

## Purpose

Fantasheee is a separate project from What's Nest. It is a mobile-first browser fantasy football app for six trusted friends and must mirror Marian's existing ESPN league rules.

Project location: `_marianfusek.com/fantasheee`

## Hard constraints

- Six teams.
- No login and no password.
- Entry screen: user taps their team logo. Trust-based identity is intentional.
- Mobile browser is the primary target. Desktop is secondary responsive expansion.
- $0 operating cost for private use.
- Full NFL player pool. Never add arbitrary bans or limitations.
- Existing ESPN league settings are the source of truth. Do not silently substitute generic ESPN/Sleeper defaults.
- Preserve decimal fantasy points.
- Players lock individually at their real NFL kickoff.
- Unlocked players may move between eligible starter and bench slots.
- Post-draft player management must include free agents, add/drop, waivers and waiver priority.
- Successful rolling waiver claim moves that team to the back of waiver priority.
- Do not build unnecessary features beyond matchup, team, players/free agents, league/transactions, lineup management, waivers and later trades if requested.

## UX direction

The interaction model should feel familiar to the old NFL Fantasy mobile app:

- matchup score and projections are prominent
- player rows are compact and readable
- position on left, player identity in center, projection/points on right
- starters and bench clearly separated
- live/locked state visible without visual clutter
- bottom mobile navigation
- player detail uses a bottom sheet

Do not copy NFL/ESPN branding, logos, artwork or exact visual styling. Recreate the useful information architecture and interaction behavior.

## Current navigation

- Matchup
- Team
- Players
- League

Do not add more primary tabs without a clear need.

## Data architecture

`js/data-provider.js` owns external NFL data.

Current free sources:

- `api.sleeper.app` for state/schedule/player ecosystem
- `api.sleeper.com` for projections and stats

The `.com` stats/projections API is undocumented. Keep it isolated. Never spread provider-specific field names across UI components.

`js/scoring.js` converts raw NFL statistics into this league's points. Do not trust provider fantasy-point totals when they conflict with league rules.

`js/config.js` is the single place for league scoring and roster-slot configuration.

## Shared state

Supabase free tier is the shared datastore.

No Supabase Auth.
No user accounts.
No password gate.

The browser remembers the tapped team using localStorage. This is convenience only, not security.

Supabase stores:

- six teams
- owned players
- weekly lineup slots
- weekly matchups
- waiver claims
- waiver order
- transaction history

Use database transactions/RPC for ownership-changing operations. A player must never be owned by two teams.

## Waivers

- An unowned player can be a free agent or waiver target depending on league state.
- Claims include `add_player_id`, optional `drop_player_id`, `team_id`, week and timestamp.
- Resolve competing claims by waiver priority.
- Winning team moves to last priority.
- Losing claims remain recorded.
- Current MVP processes due waivers opportunistically when a client opens/refetches the app. Keep this free unless Marian explicitly approves a paid service.

## Player locking

A player's real NFL kickoff is the lock boundary.

Before kickoff:
- move between eligible slots
- bench/start
- add/drop if league rules permit

At/after kickoff:
- that player cannot be moved or dropped for that scoring period
- later-game players remain editable

Never lock the whole roster at the first Sunday game.

## Scoring

Known current settings include:

- passing yard: 0.04
- passing TD: 4
- interception thrown: -2
- rushing yard: 0.1
- rushing TD: 6
- receiving yard: 0.1
- reception: 1
- receiving TD: 6
- fumble lost: -2
- PAT: 1
- FG 0–49: 3
- FG 50+: 5
- custom D/ST scoring in `APP_CONFIG.scoring.dst`

If Marian supplies a newer ESPN settings export/screenshot, update the config to match it exactly and treat that as authoritative.

## UI rules

- Inter.
- Phone-first.
- 44px-ish touch targets.
- No hover-dependent action.
- Avoid dashboard clutter, heavy cards and decorative gradients.
- Use large scores, restrained surfaces and clear hierarchy.
- Do not hide core roster actions behind multiple menus.
- Keep player names and matchup data scannable at 320px width.

## Change discipline

Before modifying anything:

1. Read this file.
2. Identify which existing flow the change touches.
3. Preserve working matchup, player pool, roster, waiver and team-picker behavior.
4. Avoid broad rewrites for local UI fixes.
5. Keep provider, scoring, shared-state and UI responsibilities separate.

After changes:

- run `node --check` on every changed JS file
- test at 320px, 390px and desktop width
- test team selection persistence
- test free-agent ownership uniqueness
- test waiver claim conflict
- test bench/start move before kickoff
- test locked-player behavior after kickoff
- test both local mode and Supabase mode when relevant

## Do not introduce

- passwords or account registration unless Marian explicitly changes the trust model
- paid sports APIs
- AI features
- superstar/player-pool restrictions
- generic fantasy rules that overwrite the ESPN-derived rules
- a separate native app requirement
- complex admin/commissioner dashboards unless requested
