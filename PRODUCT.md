# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two people: Marian and one partner, each using a separate laptop and the same public website URL.

## Product Purpose

What's Nest (`W-N`) is a private two-person NFL fantasy matchup app. Each week, the two users manually redraft NFL players to their own teams, arrange lineups, follow PPR scoring and projections, and compare the resulting head-to-head matchup.

Success means the two users can sit down, rebuild the week's rosters quickly, understand what is happening, and trust that both laptops show the same league state without needing a commissioner, account system, or fantasy-platform ceremony.

## Positioning

What's Nest is a focused shared scorekeeper for a private two-person weekly redraft. It keeps the useful matchup, roster, scoring, and schedule parts of fantasy football while deliberately avoiding the scale and machinery of a general public fantasy platform.

## Operating Context

- The app runs on a public website and is used from two separate laptops.
- Both users use the same deployed URL. Local-only mode remains available for fallback or solo work.
- At the start of each NFL week, both teams are redrafted manually from the player pool.
- The matchup view is the weekly scoreboard; the League view is for team setup, sync status, weekly settings, and transaction history.
- Supabase is optional shared storage for league state. It is not the NFL data provider and does not provide authentication.

## Capabilities and Constraints

- Keep exactly two fantasy teams.
- The default starting lineup has nine slots: `QB`, `RB 1`, `RB 2`, `WR 1`, `WR 2`, `TE`, `FLEX`, `K`, and `DEF`.
- `FLEX` accepts `RB`, `WR`, or `TE` and uses the same PPR scoring as the underlying position.
- The shared League setting controls an optional six-player bench. When off, the app has no bench slots; when on, the total roster is 15 slots and bench players do not score.
- A player can belong to only one fantasy team. Add, drop, replace, and lineup moves remain visible in transaction history.
- Each week has its own lineup snapshot. Switching weeks must not overwrite another week's roster.
- Use weekly PPR scoring with the existing passing, rushing, receiving, fumble, kicker, and reception rules.
- Keep actual PPR points and projections visibly separate. Projection data may be unavailable temporarily and must never be fabricated.
- Players already on a roster remain movable, droppable, and replaceable after their NFL game has started, until the week is complete. A new player whose game has started cannot be added.
- Once a week is complete or has a saved result, that week is read-only.
- Keep Week 1–18 navigation, matchup totals, winner/lead state, weekly results, season records, official stat corrections, and manual refresh.
- Preserve local-only operation and optional shared two-browser sync through the free Supabase setup.
- Keep operating cost at $0. Do not add paid APIs, paid infrastructure, accounts, or API-key requirements.
- Shared mode is link-private rather than authenticated. Do not imply that the public URL provides real access control.
- The public browser app has no build step; preserve the existing static HTML/CSS/JavaScript architecture.

## Brand Commitments

- The product name is What's Nest.
- The experience should feel like a polished, calm sports product rather than a generic fantasy dashboard.
- Setup and guidance copy may use restrained dry humor, but must stay clear when users are drafting or checking scores.
- Preserve uploaded team logos, local defense helmet assets, player imagery, the What's Nest favicon, and the existing editorial identity.

## Evidence on Hand

- The working product is in `apps/w-n/`.
- Product behavior and setup notes are documented in `apps/w-n/README.md` and `apps/w-n/AGENTS.md`.
- The static app entry point is `apps/w-n/index.html`; behavior is in `apps/w-n/app.js`; styling is in `apps/w-n/styles.css`.
- Supabase schema/setup is in `apps/w-n/supabase.sql`; browser-safe project configuration is in `apps/w-n/config.js`.
- NFL player data, stats, and projections currently come from free public Sleeper endpoints; schedule and live status currently come from the free public ESPN NFL scoreboard feed.
- No login, accounts, payments, public-league system, or formal commissioner workflow is part of the agreed product.

## Product Principles

- Keep the league small, private, and understandable.
- Make weekly redrafting fast and deliberate rather than turning it into a full draft-room product.
- Show the difference between real scoring, forecasts, game status, and sync status clearly.
- Preserve the same league state across two laptops without making users manage technical infrastructure during a draft.
- Prefer resilient, honest fallbacks over invented NFL data or misleading success states.
