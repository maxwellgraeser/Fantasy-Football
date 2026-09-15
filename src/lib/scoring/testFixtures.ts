import type { SleeperPlayer, SleeperPlayerStats, SleeperSeasonStats, NFLTeam } from '@/types/sleeper'

/** Test helpers — not used by the app. */
export function makePlayer(id: string, overrides: Partial<SleeperPlayer> = {}): SleeperPlayer {
  return {
    player_id: id,
    first_name: 'Test',
    last_name: id,
    full_name: `Player ${id}`,
    position: 'WR',
    fantasy_positions: ['WR'],
    team: 'KC',
    status: 'Active',
    injury_status: null,
    years_exp: 3,
    age: 26,
    college: 'State',
    height: '72',
    weight: '200',
    number: 1,
    depth_chart_position: 'WR',
    depth_chart_order: 1,
    search_rank: 50,
    metadata: { rookie_year: '2022' },
    ...overrides,
  }
}

export function makeTeamStats(team: NFLTeam, overrides: Partial<SleeperPlayerStats> = {}): [string, SleeperPlayerStats] {
  return [`TEAM_${team}`, {
    gp: 17,
    pass_att: 580,
    pass_yd: 4000,
    rush_att: 430,
    rush_yd: 1800,
    rush_rz_att: 80,
    rz_att: 55,
    rz_conv: 32,
    rec_rz_tgt: 60,
    pass_air_yd: 1800,
    pass_sack: 40,
    ...overrides,
  }]
}

export function season(entries: Array<[string, SleeperPlayerStats]>): SleeperSeasonStats {
  return Object.fromEntries(entries)
}
