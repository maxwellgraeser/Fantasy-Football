import type { SleeperPlayer, SleeperPlayerStats, FantasyPosition } from '@/types/sleeper'
import type { PlayerGradeBreakdown, ScoringFormat } from '@/types/scoring'
import { percentileRank, clamp, weightedMean } from './normalize'
import { fantasyPoints } from './format'

export interface SeasonRecord {
  season: string
  stats: SleeperPlayerStats | undefined
}

export const FULL_SEASON_GAMES = 17

/** Fantasy PPG for a set of stats in the given scoring format. */
export function computePpg(stats: SleeperPlayerStats | undefined, format: ScoringFormat = 'half_ppr'): number {
  if (!stats) return 0
  const gp = Math.max(stats.gp ?? 1, 1)
  return fantasyPoints(stats, format) / gp
}

/**
 * Age-curve adjustment: 0 around the position's peak, negative before/after.
 * Returns 0 for DEF or when age is unknown.
 */
function ageCurveAdj(age: number | null | undefined, pos: FantasyPosition): number {
  if (age == null || pos === 'DEF') return 0
  const peak = pos === 'RB' ? 25 : pos === 'QB' ? 29 : 27
  const diff = age - peak
  if (diff < -3) return -Math.abs(diff - (-3)) * 0.5
  if (diff <= 2) return 0
  if (diff <= 5) return -diff * 0.8
  return -5 + -(diff - 5) * 1.5
}

/**
 * Durability: % of team games played, averaged over seasons with recorded stats.
 * `seasonGames` maps season → games played league-wide so far (17 once complete),
 * so partial seasons aren't penalized.
 */
export function durabilityScore(records: SeasonRecord[], seasonGames: Record<string, number> = {}): number {
  const vals = records
    .filter((r) => r.stats?.gp !== undefined)
    .map((r) => {
      const teamGames = Math.max(1, seasonGames[r.season] ?? FULL_SEASON_GAMES)
      return Math.min((r.stats!.gp! / teamGames) * 100, 100)
    })
  if (!vals.length) return 50
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export interface PlayerGradeOptions {
  /** Normalized recency weights for [selected season, -1, -2]. */
  recency: [number, number, number]
  format: ScoringFormat
  seasonGames: Record<string, number>
}

/**
 * Compute PlayerGrade (0–100) for a single player vs a field of peers.
 * `peerPpgs` = PPG values for players at the same position in the selected season.
 *
 * Skill positions: 55% PPG percentile, 20% age-adjusted production, 25% durability.
 * DEF: 75% PPG percentile, 25% durability.
 */
export function computePlayerGrade(
  player: SleeperPlayer,
  records: SeasonRecord[],
  peerPpgs: number[],
  { recency, format, seasonGames }: PlayerGradeOptions,
): { grade: number; breakdown: PlayerGradeBreakdown; weightedPpg: number } {
  const pos = (player.fantasy_positions?.[0] ?? 'WR') as FantasyPosition

  const ppgs = records.map((r) => computePpg(r.stats, format))
  const weightedPpg = weightedMean(
    ppgs.slice(0, 3).map((ppg, i) => ({ value: ppg, weight: recency[i] ?? 0 })),
  )

  const ppgPercentile = percentileRank(weightedPpg, peerPpgs)
  const durability = durabilityScore(records, seasonGames)

  if (pos === 'DEF') {
    // Team defenses play every game, so durability carries no signal
    const grade = clamp(Math.round(ppgPercentile))
    const breakdown: PlayerGradeBreakdown = {
      ppgPercentile,
      recentPpg: weightedPpg,
      ageCurveAdj: 0,
      ageAdjustedPct: ppgPercentile,
      durabilityPct: durability,
    }
    return { grade, breakdown, weightedPpg }
  }

  const ageCurve = ageCurveAdj(player.age, pos)
  const ageAdjustedPct = clamp(ppgPercentile + ageCurve)

  const breakdown: PlayerGradeBreakdown = {
    ppgPercentile,
    recentPpg: weightedPpg,
    ageCurveAdj: ageCurve,
    ageAdjustedPct,
    durabilityPct: durability,
  }

  const grade = clamp(Math.round(
    weightedMean([
      { value: ppgPercentile,  weight: 0.55 },
      { value: ageAdjustedPct, weight: 0.20 },
      { value: durability,     weight: 0.25 },
    ]),
  ))

  return { grade, breakdown, weightedPpg }
}
