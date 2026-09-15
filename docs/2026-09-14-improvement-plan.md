# GridironIQ — Improvement Plan

**Date:** 2026-09-14
**Status:** Agreed — ready to implement
**Context:** Findings from a full code read plus hands-on testing of the running app (`localhost:5173`) against live Sleeper data during Week 1 of the 2026 NFL season.

## Decisions

| Question | Decision |
|---|---|
| How to handle an in-progress season | **User toggle** between the last completed season and the current season-to-date |
| Source for rookie data | **Sleeper data** — drop the hand-curated prospects JSON |
| Additional scope | Clearer **PPG trend** column (header tooltips) and a more intuitive **weights** panel that shows how weights produce the Value score |

---

## Summary of what was tested

| Area | Result |
|---|---|
| Players table load, value badges, sparklines | ✅ Works |
| Position filter, "Include rookies" | ✅ Works |
| Infinite scroll (25-row increments) | ✅ Works |
| Navbar search → player page (client-side nav) | ✅ Works |
| Watchlist add / remove / persistence | ✅ Works |
| Direct load or refresh of `/player/:id` | ❌ Blank screen (hooks crash) |
| Weights drawer edge cases | ❌ Weights can stop summing to 100% |
| Column sorting | ⚠️ Rank column wrong; nulls sort first |
| Scores / rookies / prospects | ❌ Wrong since the 2026 season started |
| Mobile (375px) | ⚠️ Search off-screen, table clipped |
| `tsc` | ✅ Clean |
| `eslint` | ❌ 3 errors, 3 warnings |

---

## P0 — Bugs

### 1. Player page crashes on direct load / refresh
- **Where:** `src/pages/PlayerDetailPage.tsx:104`
- **Cause:** `useMemo` is called after the early `return`s for loading / not-found, so hook count changes when data arrives. Console: *"Rendered more hooks than during the previous render."*
- **Repro:** Open `http://localhost:5173/player/4034` in a fresh tab → blank page.
- **Fix:** Move `statColumns` `useMemo` (or a plain call) above the early returns.

### 2. Weights can stop summing to 100%
- **Where:** `src/components/WeightsDrawer.tsx:49`
- **Cause:** When the other two weights are both 0, `currentOtherSum || 1` leaves them at 0.
- **Repro:** Drag Player Grade to 100%, then back to 50% → Opp 0%, Team 0%, total 50%; every Value score halves.
- **Fix:** Superseded by the redesigned weights control (see §P1-UX 12); in any case normalize weights inside `buildPlayerRows` so scoring never depends on UI arithmetic.

### 3. Rank `#` column is wrong after sorting
- **Where:** `src/pages/PlayersPage.tsx:49`
- **Cause:** `row.index` is the index in the source data, not the displayed position.
- **Fix:** Render the index from `visibleRows` (position in the sorted/filtered model).

### 4. Null values sort to the top
- **Where:** `src/pages/PlayersPage.tsx:113` (Age); applies to any nullable column
- **Fix:** Return `undefined` for missing values and set `sortUndefined: 'last'`.

---

## P1 — Data correctness (season rollover)

### 5. Season toggle: last full season vs. current season-to-date
- **Problem:** `currentSeason` = calendar year (`src/store/season.ts:10`). In Week 1 the single 2026 game gets 50% recency weight. Measured with default weights:
  - 2026 primary: McBride, Gibbs, Henry (34.8 PPG), Swift, Olave, Watson…
  - 2025 primary: McBride, St. Brown, Chase, Cook, Lamb, Nacua, Henry…
  - McCaffrey: 72 (2026 primary) vs 82 (2025 primary).
- **Plan:**
  - Use `useNFLState` (already written, unused) to get `season`, `previous_season`, `week`, `season_type`.
  - Add a segmented toggle on the Players page header: **`2025 · Full season`** / **`2026 · Week N`**. Persist the choice in the season store.
  - Default: last completed season until the user switches (remembered afterwards).
  - When the in-progress season is selected, show a sample-size note (e.g. "Week 1 · 1 game played — scores are volatile").
  - Recency weights, PPG column, and sparkline all key off the selected season.
  - `getSeasonsToLoad()` becomes relative to the selected season.

### 6. Durability and per-game metrics for partial seasons
- **Where:** `src/lib/scoring/playerGrade.ts:34`, `src/lib/scoring/teamGrade.ts`
- **Problem:** Durability divides by 17 regardless of games the team has played; after Week 1 healthy starters drop to 49–69%.
- **Fix:** Denominator = team games played to date (from `TEAM_XXX.gp`), capped at 17/18.

### 7. Rookie detection from Sleeper
- **Where:** `src/lib/scoring/composite.ts:131`, `src/pages/RookiesPage.tsx:28`
- **Problem:** Hardcoded `years_exp === 1` now flags the 2025 class (Jeanty, Dart, McMillan) with the 15% penalty, while actual 2026 rookies (Love, Mendoza, Sadiq — `years_exp: 0`) are not flagged. Page subtitle says `years_exp = 0`, contradicting the code.
- **Fix:** Sleeper exposes `metadata.rookie_year` (e.g. `"2026"`). `isRookie = metadata.rookie_year === selectedSeason` (fallback: `years_exp === 0`).

### 8. Rookies page built from Sleeper data
- **Problem:** `src/data/prospects-2026.json` ("2026 Incoming Draft Class") is actually the 2025 class; all 12 are in the NFL.
- **Plan:**
  - Delete `prospects-2026.json` and the prospects section.
  - **Section 1 — `{season} Rookie Class`:** Sleeper players with `metadata.rookie_year === season` on an NFL team (152 skill-position players right now). Columns: name, pos, team + team grade, age, college, depth chart, Sleeper rank (`search_rank`), YTD PPG, provisional Value.
  - Filters: position chips; "Starters only" (depth chart 1); sort by Sleeper rank by default.
  - **Section 2 — `{season − 1} Second-Year Players`** (optional): the previous class with their full rookie-season stats — useful for breakout candidates.
  - Format `height` from inches (`"72"` → `6'0"`).

### 9. Exclude retired players
- **Where:** `src/lib/scoring/composite.ts:45`
- **Problem:** Sleeper marks retired players `status: "Active"` with `team: null` (2,021 skill players — Gore, Peterson, Brady). Only `Inactive` is filtered, and loading 8 seasons (back to 2019) makes them count as "proven". They inflate the table (1,418 rows) and show up in search.
- **Fix:** Keep a player if they have a team **or** recorded games in the selected season or the one before. Apply the same predicate to navbar search. Optional "Free agents" filter chip.

### 10. DEF scoring is mostly a constant
- **Problem:** `computeAllTeamGrades` never computes DEF → Team grade is always 50; Opportunity is 36 for every defense. 45% of a DEF Value score doesn't vary.
- **Fix (pick one):** Score DEF on Player Grade only (renormalize weights for DEF), or add a DEF team grade (sacks, takeaways, points allowed). Show "n/a" for Opp/Team on DEF rows.

---

## P1 — UX: PPG trend clarity

### 11. Make the Trend column self-explanatory
Current state: sparkline of up to 8 seasons, green if last ≥ first, hover tooltip shows a bare PPG number with no season; header just says "Trend".

- **Header tooltips** (reusable `<HeaderTooltip>` on hover/focus, keyboard-accessible) for every column:
  - **Trend:** "Half-PPR points per game by season, oldest → newest (last 5 seasons played). Green = latest season is higher than the previous one; red = lower. Hollow dot = season in progress."
  - **Value:** "0–100 composite. = Player × w₁ + Opportunity × w₂ + Team × w₃ (rookies × 0.85). Click ⚙ Weights to adjust."
  - **Player / Opp / Team grades:** one-line description of what each measures (see §12).
  - **PPG:** "Half-PPR fantasy points per game in {selected season}."
  - **Exp:** "NFL seasons completed."
- **Sparkline improvements:**
  - Tooltip shows `2024 · 15.9 PPG · 17 GP`.
  - Compare latest vs **previous** season (not the oldest one) for color; add a small `▲ +2.3` / `▼ −1.1` delta label.
  - Limit to last 5 seasons played; render the in-progress season as a hollow/dashed final point.
  - Same treatment on the Watchlist page.

---

## P1 — UX: Weights that are intuitive and tied to Value

### 12. Redesign the weights panel
Current state: three sliders that silently move each other, three recency sliders that don't sum to 100%, short descriptions, and no visible link to the Value number.

- **Single split bar instead of three linked sliders.** One horizontal bar divided into Player / Opportunity / Team segments with two drag handles — the parts always visibly add to 100%. Number inputs underneath for precision.
- **Presets** (chips above the bar):
  - *Balanced* (default 55 / 20 / 25)
  - *Proven production* (75 / 10 / 15)
  - *Opportunity chaser* (35 / 45 / 20)
  - *Offense matters* (40 / 20 / 40)
- **Live worked example.** Inside the drawer, show one player (the top row, or a player the user picks) with the math updating as you drag:
  ```
  Trey McBride
  Player  88 × 55% = 48.4
  Opp     95 × 20% = 19.0
  Team    62 × 25% = 15.5
  ─────────────────────────
  Value              = 83
  ```
- **"Biggest movers" preview:** top 5 players rising/falling in rank vs. default weights, so the effect of a change is obvious.
- **Plain-language explanations** of what feeds each grade (expandable):
  - *Player Grade* — 55% PPG percentile vs. position, 20% age-adjusted production, 25% durability.
  - *Opportunity Grade* — 35% depth chart, 25% target volume, 25% touch volume, 15% games played.
  - *Team Grade* — position-specific offense context (e.g. WR: pass attempts, pass yards, red-zone targets, pass rate, air yards).
  - *Rookie adjustment* — ×0.85 while provisional.
- **Recency weights:** label with actual seasons (`2025`, `2024`, `2023`) driven by the season toggle; same split-bar control so they always sum to 100%.
- **Visible "Custom weights" badge** next to the ⚙ button when not on defaults, with one-click reset.
- **Debounce** recalculation while dragging (see §14).

### 13. Explain Value everywhere it appears
- **Value badge hover** (table + watchlist): popover with the same worked math as above.
- **Player page:** render the existing but unused `ScoreBreakdown` component, updated to show each grade's contribution in points (e.g. "Player 88 × 55% = 48.4").
- **Naming fixes:** "Efficiency" in the breakdown is really age-adjusted PPG percentile — rename to "Age-adjusted production". Remove the arbitrary scale factors on team-context bars (`rushAtt * 3.5`, etc.) in favor of league-percentile bars with raw values in the label.
- Rename duplicate table headers: group "Player / Opp / Team" under a **Grades** header row so they don't collide with the "Player" name and "Team" chip columns.

---

## P2 — Performance & code health

### 14. Data volume and recompute cost
- Players payload is 14.7 MB; each season of stats ~1.1 MB; 8 seasons loaded but scoring uses 3. Team grades are computed for all 8 seasons but only index 0 is used (`composite.ts:30`).
- `buildPlayerRows` takes ~180 ms and runs on every slider tick and on each page mount.
- **Fixes:**
  - Load 5 seasons (enough for the trend) relative to the selected season.
  - Cache only skill-position + DEF players in IndexedDB (trimmed fields); bump `CACHE_VERSION`.
  - Compute team grades only for the seasons used.
  - Share computed rows across pages (single memoized selector / query) instead of recomputing per page.
  - Debounce weight changes (~150 ms) or use `useDeferredValue`.

### 15. Lint errors and dead code
- Fix `react-hooks/use-memo` in `src/hooks/useValueScores.ts:29` (spread dependency array).
- Fix `react-refresh/only-export-components` in `src/components/PositionFilter.tsx` (move `positionBadgeClass` to `src/lib/`).
- Unused: `fetchTrending`, `fetchWeekStats`, `fetchWeekProjections`, `zScore`, `getCachedValue`. Wire in (`useNFLState`, `ScoreBreakdown` — covered above) or remove.

### 16. Search
- Debounce input; search a pre-built index of eligible players (reuses §9 predicate).
- Keyboard: ↑/↓ to move, Enter to open, Esc to close.

### 17. Project hygiene
- `git init` + initial commit (project is not under version control).
- Vitest unit tests for `normalize`, `playerGrade`, `opportunityGrade`, `teamGrade`, `composite` (including weight normalization and partial-season durability).
- Route-level code splitting (bundle is a single 724 KB chunk; recharts is heavy).
- Replace the Vite template README; set `<title>` to "GridironIQ".

---

## P3 — Additional UX

18. **Mobile:** collapse nav tabs + search into a menu/search icon; sticky player-name column in tables, or a card layout under ~640px.
19. **Error states** on Player, Rookies, and Watchlist pages (only Players handles API errors today). Replace the `innerHTML` avatar fallback on the player page with a React fallback.
20. **Scoring format toggle:** Half-PPR / PPR / Standard (`pts_ppr`, `pts_std` already in the stats payload).
21. **Watchlist:** count should reflect rendered rows; add sorting; show "no longer active" players instead of silently hiding them.
22. **Players page name filter:** `globalFilter` state exists without an input — add a filter box or remove the state.

---

## Suggested implementation order

1. **Foundation:** `git init`, fix P0 bugs (1–4), lint errors (15), add Vitest with baseline scoring tests.
2. **Season model:** `useNFLState` + season toggle (5), partial-season durability (6), rookie detection (7), retired-player filter (9), trimmed data loading (14).
3. **Rookies page** from Sleeper (8).
4. **Explainability:** header tooltips + sparkline upgrades (11), Value hover + player-page breakdown (13).
5. **Weights redesign** (12), DEF scoring (10).
6. **Polish:** search (16), mobile (18), error states (19), scoring format (20), watchlist (21–22), hygiene (17).
