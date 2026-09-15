import type {
  SleeperPlayer,
  SleeperPlayersMap,
  SleeperSeasonStats,
  NFLState,
} from '@/types/sleeper'
import { primaryPosition } from '@/lib/positions'

const BASE = 'https://api.sleeper.app/v1'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sleeper API error: ${res.status} ${url}`)
  return res.json() as Promise<T>
}

// ─── Players ─────────────────────────────────────────────────────────────────

/** Returns all ~11k NFL players (~15 MB). Trim before caching. */
export async function fetchAllPlayers(): Promise<SleeperPlayersMap> {
  return get<SleeperPlayersMap>(`${BASE}/players/nfl`)
}

/** Keep only scored positions (QB/RB/WR/TE/DEF) and the fields the app uses. */
export function trimPlayers(all: SleeperPlayersMap): SleeperPlayersMap {
  const out: SleeperPlayersMap = {}
  for (const [id, p] of Object.entries(all)) {
    if (!primaryPosition(p)) continue
    const trimmed: SleeperPlayer = {
      player_id: p.player_id,
      first_name: p.first_name,
      last_name: p.last_name,
      full_name: p.full_name,
      position: p.position,
      fantasy_positions: p.fantasy_positions,
      team: p.team ?? null,
      status: p.status ?? null,
      injury_status: p.injury_status ?? null,
      years_exp: p.years_exp,
      age: p.age ?? null,
      college: p.college ?? null,
      height: p.height ?? null,
      weight: p.weight ?? null,
      number: p.number ?? null,
      depth_chart_position: p.depth_chart_position ?? null,
      depth_chart_order: p.depth_chart_order ?? null,
      search_rank: p.search_rank ?? null,
      metadata: p.metadata?.rookie_year ? { rookie_year: p.metadata.rookie_year } : null,
    }
    out[id] = trimmed
  }
  return out
}

// ─── NFL State ───────────────────────────────────────────────────────────────

export async function fetchNFLState(): Promise<NFLState> {
  return get<NFLState>(`${BASE}/state/nfl`)
}

// ─── Stats ───────────────────────────────────────────────────────────────────

/**
 * Regular-season stats (season-to-date) for all players in a given season.
 * Returns map of player_id → stats object; also includes TEAM_XXX aggregates.
 */
export async function fetchSeasonStats(season: string): Promise<SleeperSeasonStats> {
  return get<SleeperSeasonStats>(`${BASE}/stats/nfl/regular/${season}`)
}

// ─── Player image URL ────────────────────────────────────────────────────────

export function playerImageUrl(playerId: string): string {
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`
}
