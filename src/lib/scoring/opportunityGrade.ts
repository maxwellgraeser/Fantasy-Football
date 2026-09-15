import type { SleeperPlayer } from '@/types/sleeper'
import type { SleeperPlayerStats } from '@/types/sleeper'
import type { OpportunityGradeBreakdown } from '@/types/scoring'
import { clamp, percentileRank } from './normalize'

/** Depth-chart score: starter (1) = 90, backup (2) = 50, deeper = 20 */
function depthChartScore(order: number | null): number {
  if (order === null) return 40
  if (order === 1) return 90
  if (order === 2) return 55
  if (order === 3) return 25
  return 10
}

export interface OpportunityGradeWeights {
  depthChart: number
  targetShare: number
  touchShare: number
  roleSteadiness: number
}

const DEFAULT_OPPORTUNITY_WEIGHTS: OpportunityGradeWeights = {
  depthChart: 0.35, targetShare: 0.25, touchShare: 0.25, roleSteadiness: 0.15,
}

/**
 * OpportunityGrade: combines depth-chart status, target/touch share trends.
 * `allStats` is all players at the same position, used for percentile normalization.
 */
export function computeOpportunityGrade(
  player: SleeperPlayer,
  stats: SleeperPlayerStats | undefined,
  allPositionStats: SleeperPlayerStats[],   // for percentile calcs
  weights: OpportunityGradeWeights = DEFAULT_OPPORTUNITY_WEIGHTS,
): { grade: number; breakdown: OpportunityGradeBreakdown } {
  const dcScore = depthChartScore(player.depth_chart_order)

  // Target share proxy: targets vs all-position targets
  const targets = stats?.rec_tgt ?? 0
  const allTargets = allPositionStats.map((s) => s.rec_tgt ?? 0)
  const targetSharePct = percentileRank(targets, allTargets)

  // Touch share: rush att + receptions
  const touches = (stats?.rush_att ?? 0) + (stats?.rec ?? 0)
  const allTouches = allPositionStats.map((s) => (s.rush_att ?? 0) + (s.rec ?? 0))
  const touchSharePct = percentileRank(touches, allTouches)

  // Role steadiness: inverse of "started then fell off" — use gp as a proxy
  const gp = stats?.gp ?? 0
  const allGp = allPositionStats.map((s) => s.gp ?? 0)
  const roleSteadiness = percentileRank(gp, allGp)

  const grade = clamp(Math.round(
    dcScore * weights.depthChart
    + targetSharePct * weights.targetShare
    + touchSharePct * weights.touchShare
    + roleSteadiness * weights.roleSteadiness,
  ))

  return {
    grade,
    breakdown: {
      depthChartScore: dcScore,
      targetSharePct,
      touchSharePct,
      roleSteadiness,
      depthChartWeight: weights.depthChart,
      targetShareWeight: weights.targetShare,
      touchShareWeight: weights.touchShare,
      roleSteadinessWeight: weights.roleSteadiness,
    },
  }
}
