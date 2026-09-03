# What's Nest (`W-N`)

Private two-person NFL fantasy web app.

## What this build already does

- Responsive desktop/mobile browser UI
- Full active NFL player pool from Sleeper
- Search players
- NFL-team filters, with all teams selected by default
- Position filters
- Ownership filters for available, Team One, or Team Two players
- Active/injured player filters
- Sort by top-rated, projected points, or name
- Player detail with headshot, status, weekly stats, projection, ranking
- Assign any player to either fantasy team
- 15-player roster: QB, RB, RB, WR, WR, TE, FLEX, K, DEF, and 6 bench slots
- One player cannot belong to both teams
- Drop and replace players
- Per-player kickoff locking from the free schedule feed, with stats-feed fallback
- Live game labels such as `LIVE · Q3 08:21` when the schedule feed provides them
- Move owned players between eligible lineup and bench slots, including safe swaps
- Weekly PPR scoring
- Team totals and head-to-head matchup
- Week 1–18 navigation
- A separate saved lineup for each week, with completed weeks read-only
- Season W–L–T records, points for/against, and previous weekly scores
- Transaction history
- Adaptive weekly-stat and schedule refresh while the page is open
- Manual refresh fallback
- Local-only mode works without any account
- Optional live two-browser sync through Supabase free tier

## Run it

No build step is needed.

From the `W-N` folder, run any tiny local web server, for example:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

You can also deploy the folder directly to a static host such as GitHub Pages, Netlify, Cloudflare Pages, or Vercel.

The interface now boots safely even when `index.html` is opened directly, but browsers may restrict the live NFL requests from a `file://` page. Use the local server or a deployed URL for player data, schedules, and scores.

## Public two-laptop setup

For you and one partner on separate laptops, do this once:

1. Create a free Supabase project and run `supabase.sql` in its SQL Editor.
2. Copy the Supabase URL and publishable key into `config.js`.
3. Deploy the whole `W-N` folder to one public static website.
4. Both of you open that same website address. Do not open separate downloaded copies; those are two separate leagues wearing the same outfit.
5. Open `League`, confirm the badge says `Shared sync connected`, and rename the two teams.

This is link-private rather than account-private: the agreed build has no login. Keep the site address to the two of you. If you later need real access control, that is a separate authentication decision—not something to smuggle in through a checkbox and hope for the best.

After that, draft from `Players`: open a player, choose a team, then choose a roster slot. This is intentionally a manual draft, not a full draft-room engine. Fill both teams together, then review the final lineups in `Matchup`. The in-app `Draft-day setup` card repeats this checklist when you need it.

If the badge says `Local mode only`, the app still works, but changes stay on that laptop. That is useful for a private solo test and not a successful shared league.

## $0 shared sync setup

The app works immediately without Supabase, but each browser then has its own roster data.

To make both people share one league in real time:

1. Create a free Supabase project.
2. Open Supabase SQL Editor.
3. Paste and run `supabase.sql` from this folder.
4. Open your project’s `Connect` dialog, or Settings → API Keys.
5. Copy your Project URL and publishable key.
6. Put those two values into `config.js`:

```js
window.WN_CONFIG = {
  supabaseUrl: 'YOUR_PROJECT_URL',
  supabasePublishableKey: 'YOUR_PUBLISHABLE_KEY',
  leagueId: 'whats-nest-private'
};
```

Use the browser-safe publishable key only. Never put a secret key or `service_role` key into this file; those keys bypass database security and belong only on a server.

7. Deploy the site.
8. Both of you open the same deployed URL.

Roster/team changes will then sync through Supabase Realtime.

## NFL data

Player data and NFL state use Sleeper's public API:

- `https://api.sleeper.app/v1/players/nfl`
- `https://api.sleeper.app/v1/state/nfl`

Weekly stats/projections use Sleeper endpoints currently used by community projects:

- `/stats/nfl/regular/{season}/{week}`
- `/projections/nfl/regular/{season}/{week}`

These stats/projection routes are less formally documented by Sleeper than the player API, so `app.js` keeps the provider calls isolated enough to replace later if needed.

Schedule and live game state use the free public ESPN NFL scoreboard feed only for game date, kickoff, and status. It is not used for player identity or fantasy scoring.

## Live scoring behavior

The browser adapts its refresh cadence while open:

- about every 3 minutes when a relevant kickoff is within six hours
- about every 45 seconds while a game is live
- no automatic polling when the selected week has no upcoming or live games
- a 60-second stats fallback if the schedule feed is unavailable

The manual refresh button is always available.

A player's fantasy score updates when Sleeper updates the weekly stats feed.

If a selected week’s stats request fails, cached data for that same week can remain visible; switching weeks clears the prior week’s stats before loading the new week so scores are never silently carried across weeks.

Each player locks at the scheduled kickoff of their NFL game, including before the first stat is recorded. A live game shows the feed's quarter/clock when available. If the schedule feed is unavailable, the app falls back conservatively to stats-feed participation and says so in the matchup status.

Each week keeps its own lineup snapshot, so moving between weeks does not overwrite another week's choices. When every game in a selected week is final, that week's lineup and starter totals become read-only. A later official stat correction updates the saved score instead of creating a second result.

## Current visual direction

- Inter
- neutral/off-white foundation
- oversized editorial page titles and small supporting labels
- dark score/setup moments for contrast
- larger square team identity/logo stages with styled upload controls
- editorial spacing
- restrained rounded geometry
- minimal sports UI
- no dashboard clutter

## Lineup movement

Open an owned player from the matchup or player list and choose `Move player`. The duplicate position slots are distinguished as `RB 1`/`RB 2` and `WR 1`/`WR 2`. Empty eligible slots are available directly; occupied eligible slots can be swapped only when both players are still unlocked. A locked player cannot be moved, dropped, replaced, or added after kickoff.
