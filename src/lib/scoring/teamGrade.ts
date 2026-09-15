import type { SleeperSeasonStats, NFLTeam, FantasyPosition } from '@/types/sleeper'
import type { TeamGradeBreakdown, TeamMetric } from '@/types/scoring'
import { mean, stdDev, zToGrade, clamp, weightedMean, percentileRank } from './normalize'

export const NFL_TEAMS: NFLTeam[] = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB',  'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV',  'MIA', 'MIN', 'NE',  'NO',  'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF',  'TB',  'TEN', 'WAS',
]

interface TeamRaw {
  team: NFLTeam
  games: number
  rushAtt: number
  rushYd: number
  rzRushAtt: number
  rzAtt: number      // red zone trips (rz_att)
  rzConv: number     // red zone TDs (rz_conv)
  passAtt: number
  passYd: number
  recRzTgt: number   // red zone targets
  airYd: number
  sacksAllowed: number
}

/**
 * Extract TEAM_ entries from the stats map (e.g. "TEAM_BUF").
 * Teams that haven't played yet are skipped.
 */
export function extractTeamRaws(seasonStats: SleeperSeasonStats): Map<NFLTeam, TeamRaw> {
  const map = new Map<NFLTeam, TeamRaw>()

  for (const team of NFL_TEAMS) {
    const s = seasonStats[`TEAM_${team}`]
    const games = s?.gp ?? 0
    if (!s || games <= 0) continue

    map.set(team, {
      team,
      games,
      rushAtt:      s.rush_att    ?? 0,
      rushYd:       s.rush_yd     ?? 0,
      rzRushAtt:    s.rush_rz_att ?? 0,
      rzAtt:        s.rz_att      ?? 0,
      rzConv:       s.rz_conv     ?? 0,
      passAtt:      s.pass_att    ?? 0,
      passYd:       s.pass_yd     ?? 0,
      recRzTgt:     s.rec_rz_tgt  ?? 0,
      airYd:        s.pass_air_yd ?? s.rec_air_yd ?? 0,
      sacksAllowed: s.pass_sack   ?? 0,
    })
  }

  return map
}

/** Games played so far in a season: the most games any team has played (17 once complete). */
export function seasonGamesPlayed(seasonStats: SleeperSeasonStats): number {
  let max = 0
  for (const team of NFL_TEAMS) {
    const gp = seasonStats[`TEAM_${team}`]?.gp ?? 0
    if (gp > max) max = gp
  }
  return max
}

interface MetricSpec {
  key: string
  label: string
  weight: number
  values: number[]
  percent?: boolean
  lowerIsBetter?: boolean
}

function metricGrade(value: number, allValues: number[]): number {
  const m = mean(allValues)
  const sd = stdDev(allValues, m)
  return zToGrade((value - m) / (sd || 1))
}

function gradeTeams(
  teams: TeamRaw[],
  pos: FantasyPosition,
  specs: MetricSpec[],
): Map<NFLTeam, TeamGradeBreakdown> {
  const result = new Map<NFLTeam, TeamGradeBreakdown>()

  // Oriented values: higher is always better for grading/percentiles
  const oriented = specs.map((spec) => spec.values.map((v) => (spec.lowerIsBetter ? -v : v)))

  teams.forEach((t, i) => {
    const metrics: TeamMetric[] = specs.map((spec, m) => {
      const value = spec.values[i]
      return {
        key: spec.key,
        label: spec.label,
        value,
        display: spec.percent ? `${value.toFixed(1)}%` : value.toFixed(1),
        percentile: percentileRank(oriented[m][i], oriented[m]),
        weight: spec.weight,
      }
    })
    const overallGrade = clamp(Math.round(weightedMean(
      specs.map((spec, m) => ({ value: metricGrade(oriented[m][i], oriented[m]), weight: spec.weight })),
    )))
    result.set(t.team, { overallGrade, position: pos, team: t.team, metrics })
  })

  return result
}

const perGame = (teams: TeamRaw[], f: (t: TeamRaw) => number) => teams.map((t) => f(t) / t.games)
const ratio = (teams: TeamRaw[], num: (t: TeamRaw) => number, den: (t: TeamRaw) => number) =>
  teams.map((t) => (den(t) > 0 ? (num(t) / den(t)) * 100 : 0))

function specsForPosition(teams: TeamRaw[], pos: FantasyPosition): MetricSpec[] {
  if (pos === 'RB') {
    return [
      { key: 'rushAttPg', label: 'Rush Att/G', weight: 0.30, values: perGame(teams, (t) => t.rushAtt) },
      { key: 'rushYdPg',  label: 'Rush Yd/G',  weight: 0.25, values: perGame(teams, (t) => t.rushYd) },
      { key: 'rzRushShare', label: 'RZ Rush Share', weight: 0.25, percent: true, values: ratio(teams, (t) => t.rzRushAtt, (t) => t.rushAtt) },
      { key: 'rushYpc',   label: 'Yards/Carry', weight: 0.10, values: teams.map((t) => (t.rushAtt > 0 ? t.rushYd / t.rushAtt : 0)) },
      { key: 'rzTdRate',  label: 'RZ TD Rate', weight: 0.10, percent: true, values: ratio(teams, (t) => t.rzConv, (t) => t.rzAtt) },
    ]
  }

  if (pos === 'WR' || pos === 'TE') {
    return [
      { key: 'passAttPg', label: 'Pass Att/G', weight: 0.30, values: perGame(teams, (t) => t.passAtt) },
      { key: 'passYdPg',  label: 'Pass Yd/G',  weight: 0.25, values: perGame(teams, (t) => t.passYd) },
      { key: 'passRate',  label: 'Pass Rate',  weight: 0.15, percent: true, values: ratio(teams, (t) => t.passAtt, (t) => t.passAtt + t.rushAtt) },
      { key: 'rzTgtPg',   label: 'RZ Targets/G', weight: 0.20, values: perGame(teams, (t) => t.recRzTgt) },
      { key: 'airYdPg',   label: 'Air Yd/G',   weight: 0.10, values: perGame(teams, (t) => t.airYd) },
    ]
  }

  // QB
  return [
    { key: 'playsPg',   label: 'Plays/G',    weight: 0.20, values: perGame(teams, (t) => t.rushAtt + t.passAtt) },
    { key: 'passAttPg', label: 'Pass Att/G', weight: 0.30, values: perGame(teams, (t) => t.passAtt) },
    { key: 'passYdPg',  label: 'Pass Yd/G',  weight: 0.25, values: perGame(teams, (t) => t.passYd) },
    { key: 'rzTdRate',  label: 'RZ TD Rate', weight: 0.15, percent: true, values: ratio(teams, (t) => t.rzConv, (t) => t.rzAtt) },
    { key: 'sackRate',  label: 'Sack Rate',  weight: 0.10, percent: true, lowerIsBetter: true, values: ratio(teams, (t) => t.sacksAllowed, (t) => t.passAtt + t.sacksAllowed) },
  ]
}

/**
 * Compute position-aware TeamGrade (0–100) for every team.
 * Returns nested map: team → position → TeamGradeBreakdown
 */
export function computeAllTeamGrades(
  seasonStats: SleeperSeasonStats,
  positions: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE'],
): Map<NFLTeam, Map<FantasyPosition, TeamGradeBreakdown>> {
  const teams = Array.from(extractTeamRaws(seasonStats).values())
  const result = new Map<NFLTeam, Map<FantasyPosition, TeamGradeBreakdown>>()
  if (teams.length === 0) return result

  for (const pos of positions) {
    gradeTeams(teams, pos, specsForPosition(teams, pos)).forEach((grade, team) => {
      if (!result.has(team)) result.set(team, new Map())
      result.get(team)!.set(pos, grade)
    })
  }

  return result
}
