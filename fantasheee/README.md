# Fantasheee

Mobile-first browser fantasy app for the existing six-person Sheeesh league.

## What this build already does

- Front screen has six team choices. No password or account.
- Remembers the chosen team in that browser.
- Existing local state is never treated as live; while the approved ESPN path is active it is not displayed.
- When the existing Sheeesh ESPN session is present in the same browser, the app uses the real ESPN team names, logos, starters, bench, positions, injuries, game status and kickoff locks.
- Matchup view: team logos, current points, projected points, player rows.
- Team view: starters and bench.
- Players view: NFL player pool, search, position filters, available/all/owned.
- Read-only team, matchup, player, waiver-order and activity views.
- Rolling waiver priority.
- Player lock state based on NFL kickoff from the free Sleeper schedule.
- Read-only starter/bench/flex roster display; lineup changes are made only in ESPN.
- League screen with waiver order and transaction history.
- Feed tab reads actual ESPN NFL drive-by-drive plays and shows per-player fantasy point changes; there is no demo-event fallback.
- Automatic refresh: about 60 sec while games are live, 5 min otherwise.
- Pull down from the top of the app to refresh; the latest successful refresh time is shown below the top bar.
- Responsive phone-first layout, expands on desktop.
- Free data only. No paid NFL API.

## Data

The existing Sheeesh Supabase Edge Function is the source for the private ESPN league mirror. ESPN cookies stay server-side; Fantasheee receives only normalized read-only league data. The function requests ESPN team, roster, status, matchup, settings and transaction views, and returns normalized records, waiver priority, matchup totals and transaction rows when those fields are present. When Feed is open, the same function also reads current/recent ESPN game summaries and returns individual drive plays. Fantasheee maps those plays to owned players and calculates event points from the configured Sheeesh scoring rules. It requests no play summaries on other tabs, only includes the current scoring week, and shows an honest empty/error state rather than synthetic plays.

The free Sleeper endpoints provide player metadata, weekly projections, weekly stats and NFL schedule context when ESPN does not include that field.

- ESPN teams/rosters/lineup slots: existing `../supabase/functions/sheeesh/index.ts`
- Player/schedule fallback: api.sleeper.app
- Weekly stats/projections fallback: api.sleeper.com

Fantasheee stays passwordless by design. The live read path is allowed only from `localhost:8080`, `127.0.0.1:8080`, and the Marian Fusek production origins; the existing Sheeesh function still keeps its normal password/session gate for Sheeesh itself. If the deployed function has not received this read-path change yet, Fantasheee will show its connection error and keep the local preview available. No password or ESPN cookie is copied into this app.

The app is read-only in every mode. It never creates, changes or deletes ESPN, Supabase or local league rosters, lineups, waivers, trades or transactions. All changes must be made in ESPN; refresh then reflects the current source state. The current live league week is Week 2. Before a game starts, the actual score is shown as `0.0`; projected points remain separate from actual points, so Week 1 totals cannot leak into Week 2.

The ESPN fantasy endpoint is private and unofficial, so no sync can be promised as permanently perfect: ESPN cookies can expire and ESPN can change the endpoint. The server function handles the exact six-team roster/lineup mirror and reports connection errors instead of silently inventing team data. The public ESPN game-summary feed is also unofficial and can change; Feed never substitutes demo events when it fails.

## Exact ESPN rules

All scoring is centralized in `js/config.js` and `js/scoring.js`.

Known Sheeesh scoring is already entered there: PPR, decimal yardage, TD/INT values, kicking, fumbles and the D/ST buckets recovered from the existing ESPN league setup.

The local roster slot list is centralized in `APP_CONFIG.rosterSlots`. When the live ESPN settings payload includes lineup-slot counts, Fantasheee uses those counts for the live roster surface instead of the local fallback.

## Shared six-person mode: free Supabase

Without the deployed read-only ESPN path, Supabase, or an active ESPN session, the site shows a connection state instead of synthetic/test league data.

The current Fantasheee surface only reads this data; it never writes rosters, waivers or moves. If a shared read source is used, all six phones can see the same state:

1. Create a free Supabase project.
2. Open SQL Editor.
3. Run all of `supabase/schema.sql`.
4. In Supabase: Project Settings → API.
5. Copy Project URL and anon/public key.
6. Put them in `js/config.js`:

```js
supabase: {
  url: 'https://YOURPROJECT.supabase.co',
  anonKey: 'YOUR_ANON_KEY'
}
```

No Supabase Auth is used. This is deliberate. The six people identify themselves by tapping their team logo. It is a trust-based private league.

## Put in your website

Upload the entire `fantasheee` folder to:

`_marianfusek.com/fantasheee`

Serve it through HTTP/HTTPS. ES modules do not run correctly by double-clicking `index.html` from Finder.

For local testing:

```bash
cd _marianfusek.com/fantasheee
python3 -m http.server 8080
```

Open `http://localhost:8080`.

If macOS routes Python through an unaccepted Xcode license, use the built-in Ruby server instead:

```bash
ruby -run -e httpd . -p 8080
```

## Customize six teams

`APP_CONFIG.teams` is only a configuration fallback and is never presented as live ESPN data. Do not replace it with guessed real names: the real six teams are loaded from ESPN through the existing Sheeesh function.

Each team supports:

```js
{ id: 'team-1', name: 'Crow Bros', abbr: 'CB', logo: './assets/crow-bros.png' }
```

Use the same IDs in Supabase `fantasheee_teams` and `fantasheee_matchups`.

## Important production step

The existing Supabase `sheeesh` function has been updated and deployed with the read-only ESPN play-by-play Feed. Its live endpoint was checked against the six-team league and returned `feedStatus: ready`; the Feed stays empty until real scoring changes occur. No sample events are generated. The endpoint also resolved ESPN owner names for all six teams.

The updated frontend still needs to be uploaded to the site's `/fantasheee/` directory. This repository has no configured static-hosting workflow. The function continues to use the existing `ESPN_SWID`, `ESPN_S2`, `ESPN_LEAGUE_ID=465957009` and `ESPN_SEASON=2026` secrets. If ESPN does not expose a score, projection or activity field consistently, Fantasheee leaves that field empty/zero rather than inventing a value. ESPN write-back is intentionally not part of this app.
