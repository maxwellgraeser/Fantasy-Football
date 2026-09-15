import type { SleeperSeasonStats, NFLTeam, FantasyPosition } from '@/types/sleeper'
import type { TeamGradeBreakdown } from '@/types/scoring'
import { mean, stdDev, zToGrade, clamp, weightedMean } from './normalize'

const NFL_TEAMS: NFLTeam[] = [
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
  rzAtt: number      // total red zone attempts (rz_att)
  rzConv: number     // red zone TDs (rz_conv)
  passAtt: number
  passYd: number
  passRzAtt: number  // pass_rz_att (QB dropbacks in RZ)
  recRzTgt: number   // rec_rz_tgt (targets in RZ to receivers)
  airYd: number      // rec_air_yd / pass_air_yd
  sack: number
}

/**
 * Extract TEAM_ entries from the stats map (e.g. "TEAM_BUF").
 * These are aggregated team totals Sleeper includes in the same stats response.
 */
export function extractTeamRaws(seasonStats: SleeperSeasonStats): Map<NFLTeam, TeamRaw> {
  const map = new Map<NFLTeam, TeamRaw>()

  for (const team of NFL_TEAMS) {
    const key = `TEAM_${team}`
    const s = seasonStats[key]
    if (!s) continue

    const games = s.gp ?? 17

    map.set(team, {
      team,
      games,
      rushAtt:    s.rush_att    ?? 0,
      rushYd:     s.rush_yd     ?? 0,
      rzRushAtt:  s.rush_rz_att ?? 0,
      rzAtt:      s.rz_att   ?? 0,
      rzConv:     s.rz_conv  ?? 0,
      passAtt:    s.pass_att    ?? 0,
      passYd:     s.pass_yd     ?? 0,
      passRzAtt:  s.pass_rz_att  ?? 0,
      recRzTgt:   s.rec_rz_tgt  ?? 0,
      airYd:      s.rec_air_yd  ?? (s as Record<string, number>).pass_air_yd ?? 0,
      sack:       s.sack ?? 0,
    })
  }

  return map
}

/**
 * Compute position-aware TeamGrade (0–100) for every team.
 * Returns nested map: team → position → TeamGradeBreakdown
 */
export function computeAllTeamGrades(
  seasonStats: SleeperSeasonStats,
  positions: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE'],
): Map<NFLTeam, Map<FantasyPosition, TeamGradeBreakdown>> {
  const teamRaws = extractTeamRaws(seasonStats)
  const teams = Array.from(teamRaws.values())

  const result = new Map<NFLTeam, Map<FantasyPosition, TeamGradeBreakdown>>()

  for (const pos of positions) {
    const grades = computeGradesForPosition(teams, pos)
    grades.forEach((grade, team) => {
      if (!result.has(team)) result.set(team, new Map())
      result.get(team)!.set(pos, grade)
    })
  }

  return result
}

function metricGrade(value: number, allValues: number[]): number {
  const m = mean(allValues)
  const sd = stdDev(allValues, m)
  return zToGrade((value - m) / (sd || 1))
}

function computeGradesForPosition(
  teams: TeamRaw[],
  pos: FantasyPosition,
): Map<NFLTeam, TeamGradeBreakdown> {
  const result = new Map<NFLTeam, TeamGradeBreakdown>()

  if (pos === 'RB') {
    const rushAttPgs   = teams.map((t) => t.rushAtt   / t.games)
    const rushYdPgs    = teams.map((t) => t.rushYd    / t.games)
    const rzSharePcts  = teams.map((t) => t.rushAtt > 0 ? (t.rzRushAtt / t.rushAtt) * 100 : 0)
    const rushYpcs     = teams.map((t) => t.rushAtt > 0 ? t.rushYd / t.rushAtt : 0)
    const rzConvRates  = teams.map((t) => t.rzAtt > 0 ? (t.rzConv / t.rzAtt) * 100 : 0)

    teams.forEach((t, i) => {
      const components = [
        { value: metricGrade(rushAttPgs[i],  rushAttPgs),  weight: 0.30 },
        { value: metricGrade(rushYdPgs[i],   rushYdPgs),   weight: 0.25 },
        { value: metricGrade(rzSharePcts[i], rzSharePcts), weight: 0.25 },
        { value: metricGrade(rushYpcs[i],    rushYpcs),    weight: 0.10 },
        { value: metricGrade(rzConvRates[i], rzConvRates), weight: 0.10 },
      ]
      result.set(t.team, {
        overallGrade: clamp(Math.round(weightedMean(components))),
        position: pos,
        team: t.team,
        rushAttPerGame:  rushAttPgs[i],
        rushYdPerGame:   rushYdPgs[i],
        rzRushSharePct:  rzSharePcts[i],
        rushYpc:         rushYpcs[i],
      })
    })
    return result
  }

  if (pos === 'WR' || pos === 'TE') {
    const passAttPgs   = teams.map((t) => t.passAtt  / t.games)
    const passYdPgs    = teams.map((t) => t.passYd   / t.games)
    const airYdPgs     = teams.map((t) => t.airYd    / t.games)
    const rzTgtPgs     = teams.map((t) => t.recRzTgt / t.games)
    const totalPgs     = teams.map((t, idx) =>
      (teams[idx].rushAtt + teams[idx].passAtt) / t.games,
    )
    const neutralPRs   = teams.map((_t, idx) =>
      totalPgs[idx] > 0 ? (passAttPgs[idx] / totalPgs[idx]) * 100 : 50,
    )

    teams.forEach((t, i) => {
      const components = [
        { value: metricGrade(passAttPgs[i],  passAttPgs),  weight: 0.30 },
        { value: metricGrade(passYdPgs[i],   passYdPgs),   weight: 0.25 },
        { value: metricGrade(neutralPRs[i],  neutralPRs),  weight: 0.15 },
        { value: metricGrade(rzTgtPgs[i],    rzTgtPgs),    weight: 0.20 },
        { value: metricGrade(airYdPgs[i],    airYdPgs),    weight: 0.10 },
      ]
      result.set(t.team, {
        overallGrade: clamp(Math.round(weightedMean(components))),
        position: pos,
        team: t.team,
        passAttPerGame:   passAttPgs[i],
        passYdPerGame:    passYdPgs[i],
        neutralPassRate:  neutralPRs[i],
        rzTargetSharePct: rzTgtPgs[i] * 10,   // scale to approx 0–100 range for display
        airYdPerGame:     airYdPgs[i],
      })
    })
    return result
  }

  // QB
  const passAttPgs  = teams.map((t) => t.passAtt / t.games)
  const passYdPgs   = teams.map((t) => t.passYd  / t.games)
  const totalPgs    = teams.map((t) => (t.rushAtt + t.passAtt) / t.games)
  const rzTdRates   = teams.map((t) => t.rzAtt > 0 ? (t.rzConv / t.rzAtt) * 100 : 0)
  const sackRateInvs = teams.map((t) =>
    t.passAtt > 0 ? clamp(100 - (t.sack / t.passAtt) * 1000) : 50,
  )

  teams.forEach((t, i) => {
    const components = [
      { value: metricGrade(totalPgs[i],      totalPgs),      weight: 0.20 },
      { value: metricGrade(passAttPgs[i],    passAttPgs),    weight: 0.30 },
      { value: metricGrade(passYdPgs[i],     passYdPgs),     weight: 0.25 },
      { value: metricGrade(rzTdRates[i],     rzTdRates),     weight: 0.15 },
      { value: metricGrade(sackRateInvs[i],  sackRateInvs),  weight: 0.10 },
    ]
    result.set(t.team, {
      overallGrade: clamp(Math.round(weightedMean(components))),
      position: pos,
      team: t.team,
      totalPlaysPerGame: totalPgs[i],
      passAttPerGame:    passAttPgs[i],
      passYdPerGame:     passYdPgs[i],
      rzTdRate:          rzTdRates[i],
      sackRateInv:       sackRateInvs[i],
    })
  })
  return result
}
