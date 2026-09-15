import type { SleeperPlayer, SleeperPlayerStats, FantasyPosition } from '@/types/sleeper'
import type { PlayerGradeBreakdown, ScoringWeights } from '@/types/scoring'
import { percentileRank, clamp, weightedMean } from './normalize'

export interface SeasonRecord {
  season: string
  stats: SleeperPlayerStats | undefined
}

/** Compute fantasy PPG (half PPR) for a set of stats. */
export function computePpg(stats: SleeperPlayerStats | undefined): number {
  if (!stats) return 0
  const gp = Math.max(stats.gp ?? 1, 1)
  const pts = stats.pts_half_ppr ?? 0
  return pts / gp
}

/**
 * Age-curve adjustment: peak at 26, -0.5/yr before 24, -1/yr after 30, -2/yr after 34.
 * Returns 0 for positions where age curve doesn't apply (DEF) or age is unknown.
 */
function ageCurveAdj(age: number | null | undefined, pos: FantasyPosition): number {
  // DEF has no individual age; also guard against undefined (field missing from API)
  if (age == null || pos === 'DEF') return 0
  const peak = pos === 'RB' ? 25 : pos === 'QB' ? 29 : 27
  const diff = age - peak
  if (diff < -3) return -Math.abs(diff - (-3)) * 0.5
  if (diff <= 2) return 0
  if (diff <= 5) return -diff * 0.8
  return -5 + -(diff - 5) * 1.5
}

/** Durability: % of 17 games played, averaged over available seasons. */
function durabilityScore(records: SeasonRecord[]): number {
  const maxGames = 17
  const vals = records
    .filter((r) => r.stats?.gp !== undefined)
    .map((r) => Math.min((r.stats!.gp! / maxGames) * 100, 100))
  if (!vals.length) return 50
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

/**
 * Compute PlayerGrade (0–100) for a single player vs a field of peers.
 * `peerPpgs` = all PPG values for players at same position this season.
 *
 * DEF units are scored differently: no age curve, no efficiency proxy —
 * just PPG percentile (vs other DEFs) and durability.
 */
export function computePlayerGrade(
  player: SleeperPlayer,
  records: SeasonRecord[],
  peerPpgs: number[],
  weights: ScoringWeights,
): { grade: number; breakdown: PlayerGradeBreakdown; weightedPpg: number } {
  const pos = (player.fantasy_positions?.[0] ?? 'WR') as FantasyPosition

  // Weighted recency PPG
  const ppgs = records.map((r) => computePpg(r.stats))
  const recencyWeights = [weights.recencyY1, weights.recencyY2, weights.recencyY3]
  const weightedPpg = weightedMean(
    ppgs.slice(0, 3).map((ppg, i) => ({ value: ppg, weight: recencyWeights[i] ?? 0 })),
  )

  const ppgPercentile = percentileRank(weightedPpg, peerPpgs)
  const durability = durabilityScore(records)

  if (pos === 'DEF') {
    // DEF grade: purely PPG percentile vs other defenses + durability
    const grade = clamp(Math.round(
      weightedMean([
        { value: ppgPercentile, weight: 0.75 },
        { value: durability,    weight: 0.25 },
      ]),
    ))
    const breakdown: PlayerGradeBreakdown = {
      ppgPercentile,
      recentPpg: weightedPpg,
      ageCurveAdj: 0,
      durabilityPct: durability,
      efficiencyPct: ppgPercentile, // same as PPG percentile for DEF
    }
    return { grade, breakdown, weightedPpg }
  }

  // Skill-position grade
  const ageCurve = ageCurveAdj(player.age, pos)
  const efficiencyPct = clamp(ppgPercentile + ageCurve)

  const breakdown: PlayerGradeBreakdown = {
    ppgPercentile,
    recentPpg: weightedPpg,
    ageCurveAdj: ageCurve,
    durabilityPct: durability,
    efficiencyPct,
  }

  const grade = clamp(Math.round(
    weightedMean([
      { value: ppgPercentile,  weight: 0.55 },
      { value: efficiencyPct,  weight: 0.20 },
      { value: durability,     weight: 0.25 },
    ]),
  ))

  return { grade, breakdown, weightedPpg }
}
