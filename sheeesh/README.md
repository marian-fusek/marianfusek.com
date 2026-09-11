# Sheeesh

`/sheeesh` is a private, read-only ESPN fantasy roster view. It shows each ESPN team’s name and logo, starters on the left, bench on the right, player avatars, positions, game time, played/not-played state, and injury warnings. It intentionally does not show fantasy points, projections, live scores, standings, or lineup controls.

## Supabase setup

The Edge Function lives at `../supabase/functions/sheeesh/index.ts` and keeps the ESPN cookies on the server. In the Supabase project, add these Edge Function secrets:

```text
ESPN_SWID
ESPN_S2
ESPN_LEAGUE_ID=465957009
ESPN_SEASON=2026
SHEEESH_PASSWORD=sheeesh
```

Deploy the function as `sheeesh` from the Supabase Edge Functions dashboard. The included `supabase/config.toml` disables Supabase JWT verification because this function uses its own short-lived password session instead. The browser never receives the ESPN cookies.

Upload the whole `sheeesh` folder to the public site root. It will then be available at `https://marianfusek.com/sheeesh/`. The page uses the existing W-N Supabase URL and publishable key from `../apps/w-n/config.js`.

The password session lasts 12 hours in that browser tab. If ESPN stops authorizing the request later, refresh `ESPN_SWID` and `ESPN_S2` in Supabase Secrets; ESPN session cookies expire.
