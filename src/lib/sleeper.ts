import type {
  SleeperPlayer,
  SleeperPlayersMap,
  SleeperSeasonStats,
  NFLState,
  TrendingPlayer,
  SleeperUser,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperRoster,
  SleeperMatchup,
} from '@/types/sleeper'
import { ROSTERABLE_POSITIONS } from '@/lib/positions'

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

/**
 * Keep only fantasy-rosterable positions and the fields the app uses. Kickers and IDP
 * are kept so league rosters can name them; scoring still filters to scored positions.
 */
export function trimPlayers(all: SleeperPlayersMap): SleeperPlayersMap {
  const out: SleeperPlayersMap = {}
  for (const [id, p] of Object.entries(all)) {
    const pos = p.fantasy_positions?.[0]
    if (!pos || !ROSTERABLE_POSITIONS.includes(pos)) continue
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

// ─── Trending players ────────────────────────────────────────────────────────

/** Players being added (or dropped) across Sleeper leagues right now. */
export async function fetchTrendingPlayers(
  type: 'add' | 'drop',
  lookbackHours = 24,
  limit = 25,
): Promise<TrendingPlayer[]> {
  return get<TrendingPlayer[]>(
    `${BASE}/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`,
  )
}

// ─── Users & leagues ─────────────────────────────────────────────────────────

/** Looks up a Sleeper account by username (or user ID). Resolves null when none exists. */
export async function fetchUser(usernameOrId: string): Promise<SleeperUser | null> {
  return get<SleeperUser | null>(`${BASE}/user/${encodeURIComponent(usernameOrId.trim())}`)
}

export async function fetchUserLeagues(userId: string, season: string): Promise<SleeperLeague[]> {
  return get<SleeperLeague[]>(`${BASE}/user/${userId}/leagues/nfl/${season}`)
}

export async function fetchLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  return get<SleeperLeagueUser[]>(`${BASE}/league/${leagueId}/users`)
}

export async function fetchLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  return get<SleeperRoster[]>(`${BASE}/league/${leagueId}/rosters`)
}

export async function fetchLeagueMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  return get<SleeperMatchup[]>(`${BASE}/league/${leagueId}/matchups/${week}`)
}

export function avatarUrl(avatarId: string): string {
  return `https://sleepercdn.com/avatars/thumbs/${avatarId}`
}

// ─── Player image URL ────────────────────────────────────────────────────────

export function playerImageUrl(playerId: string): string {
  return `https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`
}
