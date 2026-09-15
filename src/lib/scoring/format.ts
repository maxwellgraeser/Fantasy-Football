import type { SleeperPlayerStats } from '@/types/sleeper'
import type { ScoringFormat } from '@/types/scoring'

export const SCORING_FORMAT_LABELS: Record<ScoringFormat, string> = {
  half_ppr: 'Half-PPR',
  ppr: 'PPR',
  std: 'Standard',
}

/** Season fantasy points for the chosen scoring format. */
export function fantasyPoints(stats: SleeperPlayerStats | undefined, format: ScoringFormat): number {
  if (!stats) return 0
  switch (format) {
    case 'ppr':
      return stats.pts_ppr ?? stats.pts_half_ppr ?? 0
    case 'std':
      return stats.pts_std ?? stats.pts_half_ppr ?? 0
    default:
      return stats.pts_half_ppr ?? 0
  }
}
