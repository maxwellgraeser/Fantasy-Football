import type {
  SleeperPlayersMap,
  SleeperSeasonStats,
  SleeperTrendingPlayer,
  NFLState,
} from '@/types/sleeper'

const BASE = 'https://api.sleeper.app/v1'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status} ${url}`)
  return res.json() as Promise<T>
}

// ─── Players ─────────────────────────────────────────────────────────────────

/** Returns all ~10k NFL players. Cache this aggressively. */
export async function fetchAllPlayers(): Promise<SleeperPlayersMap> {
  return get<SleeperPlayersMap>(`${BASE}/players/nfl`)
}

// ─── NFL State ───────────────────────────────────────────────────────────────

export async function fetchNFLState(): Promise<NFLState> {
  return get<NFLState>(`${BASE}/state/nfl`)
}

// ─── Stats ───────────────────────────────────────────────────────────────────

/**
 * Full-season stats for all players in a given season.
 * Returns map of player_id → stats object.
 * Uses the community-known (stable, undocumented) stats endpoint.
 */
export async function fetchSeasonStats(season: string): Promise<SleeperSeasonStats> {
  return get<SleeperSeasonStats>(`${BASE}/stats/nfl/regular/${season}`)
}

/**
 * Stats for a single week. Used if we need per-week drilldown.
 */
export async function fetchWeekStats(season: string, week: number): Promise<SleeperSeasonStats> {
  return get<SleeperSeasonStats>(`${BASE}/stats/nfl/regular/${season}/${week}`)
}

// ─── Projections ─────────────────────────────────────────────────────────────

export async function fetchWeekProjections(season: string, week: number): Promise<SleeperSeasonStats> {
  return get<SleeperSeasonStats>(`${BASE}/projections/nfl/regular/${season}/${week}`)
}

// ─── Trending ────────────────────────────────────────────────────────────────

export async function fetchTrending(
  type: 'add' | 'drop' = 'add',
  lookbackHours = 24,
  limit = 25,
): Promise<SleeperTrendingPlayer[]> {
  return get<SleeperTrendingPlayer[]>(
    `${BASE}/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`,
  )
}

// ─── Player image URL ────────────────────────────────────────────────────────

export function playerImageUrl(playerId: string): string {
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`
}
