// ─── Sleeper Player (from /players/nfl) ─────────────────────────────────────

export type FantasyPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'DL' | 'LB' | 'DB' | 'IDP_FLEX'
export type NFLTeam =
  | 'ARI' | 'ATL' | 'BAL' | 'BUF' | 'CAR' | 'CHI' | 'CIN' | 'CLE'
  | 'DAL' | 'DEN' | 'DET' | 'GB'  | 'HOU' | 'IND' | 'JAX' | 'KC'
  | 'LAC' | 'LAR' | 'LV'  | 'MIA' | 'MIN' | 'NE'  | 'NO'  | 'NYG'
  | 'NYJ' | 'PHI' | 'PIT' | 'SEA' | 'SF'  | 'TB'  | 'TEN' | 'WAS'

export type InjuryStatus = 'Questionable' | 'Doubtful' | 'Out' | 'IR' | 'PUP' | null

export interface SleeperPlayer {
  player_id: string
  first_name: string
  last_name: string
  full_name?: string | null
  position: string
  fantasy_positions: FantasyPosition[]
  team: NFLTeam | null
  status: 'Active' | 'Inactive' | 'Injured Reserve' | 'Practice Squad' | string | null
  injury_status: InjuryStatus
  years_exp: number | undefined
  age: number | null
  college: string | null
  height: string | null       // inches, e.g. "72"
  weight: string | null
  number: number | null
  depth_chart_position: string | null
  depth_chart_order: number | null
  search_rank: number | null  // 9999999 = unranked
  metadata?: { rookie_year?: string } | null
}

export type SleeperPlayersMap = Record<string, SleeperPlayer>

// ─── Sleeper Stats (from /stats/nfl/regular/{season}) ───────────────────────

export interface SleeperPlayerStats {
  // Passing
  pass_att?: number
  pass_cmp?: number
  pass_yd?: number
  pass_td?: number
  pass_int?: number
  pass_2pt?: number
  pass_rz_att?: number
  pass_sack?: number
  pass_air_yd?: number
  // Rushing
  rush_att?: number
  rush_yd?: number
  rush_td?: number
  rush_2pt?: number
  // Receiving
  rec?: number
  rec_tgt?: number
  rec_yd?: number
  rec_td?: number
  rec_2pt?: number
  // Red Zone
  rush_rz_att?: number
  rush_goal_att?: number
  rec_rz_tgt?: number
  // Air yards
  rec_air_yd?: number
  // Misc
  fum_lost?: number
  off_snp?: number
  // Team-level fields present on TEAM_ entries
  rz_att?: number
  rz_conv?: number
  sack?: number
  // Defensive (DEF position — team defense)
  int?: number           // interceptions
  def_td?: number        // defensive + special teams TDs
  fum_rec?: number       // fumble recoveries
  safe?: number          // safeties
  blk_kick?: number      // blocked kicks/punts
  pts_allow?: number     // points allowed
  // Fantasy points
  pts_half_ppr?: number
  pts_ppr?: number
  pts_std?: number
  // Games
  gp?: number
}

export type SleeperSeasonStats = Record<string, SleeperPlayerStats>
// key = player_id

// ─── NFL State ───────────────────────────────────────────────────────────────

// ─── Trending players (from /players/nfl/trending/{add|drop}) ──────────────

export interface TrendingPlayer {
  player_id: string
  count: number   // number of leagues that added/dropped this player in the lookback window
}

export interface NFLState {
  week: number
  season_type: string
  season_start_date: string
  season: string
  previous_season: string
  leg: number
  league_season: string
  display_week: number
}
