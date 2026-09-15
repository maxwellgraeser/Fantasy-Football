# Min Max Fantasy

A fantasy-football player-value dashboard built on live [Sleeper](https://docs.sleeper.com/) data. Every QB, RB, WR, TE and team defense gets a 0–100 **Value** score that explains itself: hover a score to see the math, and tune the weights to match how you draft.

## Features

- **Players** — sortable, filterable table with Value, grades, PPG and a per-season trend sparkline. Toggle between the last completed season and the current season-to-date, and between Half-PPR / PPR / Standard scoring.
- **Trending** — who the league is adding right now, straight from Sleeper's waiver-wire trend data.
- **Weights** — split-bar controls and presets for how Player, Opportunity and Team grades combine, with a live worked example and the biggest movers vs. defaults.
- **Rookies** — the current rookie class and second-year players, straight from Sleeper.
- **Player pages** — season log, PPG history and a full score breakdown.
- **Watchlist** — saved in your browser.

## How Value is calculated

```
Value = Player × w₁ + Opportunity × w₂ + Team × w₃     (defaults 55 / 20 / 25)
        × 0.85 for provisional rookies
```

| Grade | Inputs |
|---|---|
| **Player** | 55% recency-weighted PPG percentile vs. position · 20% age-adjusted production · 25% durability (share of team games played) |
| **Opportunity** | 35% depth chart · 25% target volume · 25% touch volume · 15% games played |
| **Team** | Position-specific offensive context vs. the other 31 teams (e.g. WR: pass attempts, pass yards, pass rate, red-zone targets, air yards) |

Weights are always normalized before scoring. Team defenses are scored on Player grade only.

Scoring lives in `src/lib/scoring/` and is covered by unit tests.

## Development

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest unit tests
npm run lint
npm run build    # type-check + production build
```

Data is fetched client-side from the public Sleeper API and cached in IndexedDB (players 24 h, stats 6 h). No API key needed.

## Project layout

```
src/
  components/   UI building blocks, ScoresProvider (computes scores once for the app)
  hooks/        data hooks (players, stats, NFL state, season context, value scores)
  lib/          Sleeper client, cache, season model, positions
  lib/scoring/  grades, composite Value, explanations (+ tests)
  pages/        Players, Player detail, Rookies, Watchlist
  store/        zustand stores (weights, season mode, settings, watchlist)
```
