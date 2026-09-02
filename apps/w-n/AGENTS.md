# AGENTS.md — What's Nest (`W-N`)

## Purpose

What's Nest is a private, browser-based, two-person NFL fantasy matchup app. Two people manually assign NFL players to their own teams, set weekly lineups, follow live/official weekly PPR scoring, and compare results across Weeks 1–18. It is a focused scorekeeper, not a general fantasy platform.

## Hard constraints

- Keep exactly two fantasy teams and exactly 10 roster slots per team: `QB`, `RB`, `RB`, `WR`, `WR`, `TE`, `FLEX`, `K`, `DEF`, and `BENCH`.
- Show the full active NFL player pool. Do not add a “cut the stars” flow, banned-player list, artificial player limits, or a restriction against superstars; any such rule is a private house rule.
- Keep the operating cost at $0 for this private use. Do not introduce paid APIs, paid infrastructure, API-key requirements, or a dependency on Tank01.
- Preserve both modes: local-only use must work immediately, and optional shared two-browser sync must work through the free Supabase setup.
- Shared mode is intentionally link-private, not authenticated. Do not imply that the public site restricts access to exactly two people; adding real access control requires an explicit product decision because accounts are out of scope.
- A player can belong to only one fantasy team. Keep add, drop, replace, and lineup moves auditable through transaction history.
- Use the established browser-first architecture and existing no-build-step shape unless a change is explicitly requested.

## Visual direction

The product should feel like a polished sports product: immersive, minimal, editorial, and calm. Use Inter, disciplined grid/layout, generous spacing, oversized page titles, very small supporting labels, strong score typography, larger square team identity/logo stages, restrained rounded corners, a neutral black/white/off-white foundation, dark contrast moments, and team colors only as accents. Use player photos sparingly and cleanly. File/logo upload controls must be intentionally styled, never left as browser-default controls.

Do not introduce ESPN-style density, generic fantasy dashboards, card-heavy layouts, decorative gradients, excessive borders, loud sports graphics, cramped tables, or unnecessary icons.

## Architecture and file conventions

This is a small static app with no build step:

- `index.html` — shell, navigation, dialogs, and script/style entry points.
- `styles.css` — visual system, layout, components, and responsive rules.
- `app.js` — state, rendering, interactions, scoring, player data, and refresh behavior.
- `config.js` — optional Supabase URL/key and private league ID only; never commit secrets.
- For browser sync, use Supabase’s publishable key (the legacy `anon` key remains accepted for compatibility). Never expose a secret or `service_role` key in the static site.
- `supabase.sql` — the minimal `wn_state` table and Realtime/RLS setup for shared state.
- `README.md` — setup and user-facing behavior; update it when behavior or setup changes.

Keep state and provider boundaries small and recognizable. Store league state locally with the existing `wn-state-v1` shape and use Supabase only for What's Nest state (`teams`, rosters, lineups, transactions, results, and timestamps). NFL stats do not belong in Supabase. Avoid adding a framework, build pipeline, state library, or dependency for a problem the current files already solve.

## NFL data-source rules

- Sleeper is the current free source for the active NFL player pool, player metadata/headshots, NFL state, weekly stats, and projections.
- Keep all provider URLs and normalization in the existing data-loading area so a source can be replaced without rewriting the UI.
- The weekly stats/projection routes are less formally documented than the player endpoint. Handle failed or partial responses gracefully, retain cached data where appropriate, and keep the manual refresh fallback.
- Never display a prior week’s stats as if they belonged to the selected week. Clear in-memory weekly stats when changing weeks; retain only same-week cached data during a failed refresh.
- The free public ESPN NFL scoreboard feed is the schedule/live-status source only. Use it for kickoff, game state, and quarter/clock labels; never use it for player identity or fantasy scoring.
- Never fabricate live status, quarter/clock values, scores, projections, or kickoff times. The current build locks from the schedule feed when available and falls back conservatively to stats-feed participation when that schedule feed is unavailable; always make that fallback visible.
- Refresh sparingly: cached player data, weekly data refresh while the app is open, slower refresh before games, roughly 30–60 seconds during live play, and stop when games are finished. Do not poll continuously when it adds no value.

## Roster, scoring, and game-lock rules

- Use weekly PPR scoring: 1 point per reception; 1 per 10 rushing/receiving yards; 6 per rushing/receiving touchdown; 4 per passing touchdown; 1 per 25 passing yards; −2 per interception; −2 per lost fumble; standard kicker points matching the existing formula.
- Count only the nine starter slots in the team total. `BENCH` is visible and movable but does not score.
- Preserve a separate lineup snapshot for every week. Switching weeks must restore that week’s snapshot instead of sharing one mutable roster across the season.
- Once a week is complete or has a saved result, treat that week as read-only: no add, drop, replace, or lineup move, while later weeks remain editable.
- Enforce slot eligibility: position slots accept their position; `FLEX` accepts `RB`, `WR`, or `TE`; `BENCH` accepts any supported fantasy position.
- Lock each player individually when that player's real NFL game begins. A locked early player cannot be moved, dropped, replaced, or newly added; players whose games have not begun remain editable.
- A lock is not a whole-roster lock. Preserve later-game flexibility throughout the week.
- Keep Week 1–18 navigation, matchup totals, winner/lead state, weekly results, and the ability to reflect official stat corrections.

## Responsive behavior and UX expectations

- Desktop: clean two-column matchup presentation with both teams, logos, scores, and comparable player rows.
- Mobile: stack the matchup into a readable vertical comparison without losing the head-to-head relationship; keep rows scannable and controls comfortably tappable. The bottom navigation treatment may remain fixed on small screens.
- Player setup must feel editorial: searchable large rows, all NFL teams selected by default, deselectable team chips, position filters, ownership filters (`Available`, either team), active/injured filters, top-rated sorting by default, projection/name alternatives, and a focused detail view with photo, status, rank, projection, and weekly stats.
- Make ownership, availability, projection, score, lock/open state, live state, and sync state clear without forcing the user to infer them.
- Keep the League view’s concise `Draft-day setup` guide visible. It must explain the public shared URL, two-team manual assignment flow, weekly lineup movement, kickoff locks, and the difference between shared sync and local-only mode.
- Preserve manual refresh, visible sync feedback, loading/empty/error states, confirmation for destructive reset, and accessible labels/dialog close behavior.
- Keep the interface usable with long names, missing photos, missing stats, slow feeds, and narrow screens.

## Do not introduce

Do not add accounts, public leagues, payments, messaging, commissioner tooling, a normal draft engine, a complex waiver/trade system, deep-roster expansion, artificial superstar exclusions, paid data services, fake live-game details, or dashboard clutter. Defer trades and other league machinery unless the product owner explicitly asks for them.

## Testing expectations

Before handing off a change, run a syntax check where useful and serve the folder with a tiny local web server. Smoke-test both desktop and narrow mobile layouts. Verify local mode first, then shared mode if Supabase is configured. Exercise the League setup guide, player loading/search/filter/sort/detail, ownership and health filters, assigning to both teams, both duplicate RB and WR slots, slot eligibility, replacing/dropping, moving/swapping, transaction history, Week 1–18 navigation with lineup snapshots, completed-week read-only behavior, starter-vs-bench totals, season records/results, refresh/cache behavior, and per-player lock behavior. Check the browser console and network failures; do not treat a blank or stale UI as an acceptable fallback.

## Change discipline

Read `README.md`, `config.js`, and the relevant state/rendering path before editing. Prefer the smallest localized change, preserve existing DOM hooks and state keys, and avoid rewrites that can regress local mode, optional sync, mobile layout, or scoring. When changing a rule or user-visible behavior, update the README and this file if the constraint has changed. Recheck the archive contents whenever packaging `W-N.zip` so `AGENTS.md` is at the project root and no secrets or generated artifacts are included.

## Progress reporting

Every Codex handoff must state a rough completion percentage for the agreed What's Nest v1 scope, the next missing milestone, and any remaining blocker or user action. Do not report the project as complete while launch/setup work or real-game validation remains unverified. Keep the estimate scoped to the locked product; do not create new features merely to increase the percentage.
