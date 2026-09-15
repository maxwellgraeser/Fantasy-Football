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
  full_name?: string
  position: string
  fantasy_positions: FantasyPosition[]
  team: NFLTeam | null
  status: 'Active' | 'Inactive' | 'Injured Reserve' | 'Practice Squad' | string | null
  injury_status: InjuryStatus
  injury_notes?: string | null
  injury_start_date?: string | null
  years_exp: number | undefined
  age: number | null
  college: string | null
  height: string | null
  weight: string | null
  number: number | null
  depth_chart_position: number | null
  depth_chart_order: number | null
  search_rank: number | null
  hashtag: string | null
  sportradar_id: string | null
  yahoo_id: number | null
  espn_id: number | null
  fantasy_data_id: number | null
  rotowire_id: number | null
  rotoworld_id: number | null
  stats_id: string | null
  birth_country: string | null
  sport: 'nfl'
  metadata?: Record<string, string> | null
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
  // Fantasy points (half PPR)
  pts_half_ppr?: number
  pts_ppr?: number
  pts_std?: number
  // Games
  gp?: number
}

export type SleeperSeasonStats = Record<string, SleeperPlayerStats>
// key = player_id

// ─── Sleeper Weekly Stats ────────────────────────────────────────────────────

export interface SleeperWeeklyStats {
  player_id: string
  week: number
  season: string
  stats: SleeperPlayerStats
}

// ─── Sleeper Trending ────────────────────────────────────────────────────────

export interface SleeperTrendingPlayer {
  player_id: string
  count: number
}

// ─── NFL State ───────────────────────────────────────────────────────────────

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
