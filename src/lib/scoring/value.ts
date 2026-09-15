import type {
  GradeWeights,
  ScoringWeights,
  ValueContribution,
  GradeKey,
} from '@/types/scoring'
import { DEFAULT_WEIGHTS } from '@/types/scoring'
import { clamp } from './normalize'

export const ROOKIE_MULTIPLIER = 0.85

export const GRADE_LABELS: Record<GradeKey, string> = {
  player: 'Player',
  opportunity: 'Opportunity',
  team: 'Team',
}

export interface GradeSet {
  playerGrade: number
  opportunityGrade: number | null
  teamGrade: number | null
  isRookie: boolean
}

export interface ValueResult {
  valueScore: number
  appliedWeights: GradeWeights
  contributions: ValueContribution[]
  rookieMultiplier: number
}

/** Normalize the three grade weights so they sum to 1 (all-zero → defaults). */
export function normalizeGradeWeights(
  w: Pick<ScoringWeights, 'wPlayer' | 'wOpportunity' | 'wTeam'>,
): GradeWeights {
  const p = Math.max(0, w.wPlayer || 0)
  const o = Math.max(0, w.wOpportunity || 0)
  const t = Math.max(0, w.wTeam || 0)
  const sum = p + o + t
  if (sum === 0) {
    return normalizeGradeWeights(DEFAULT_WEIGHTS)
  }
  return { player: p / sum, opportunity: o / sum, team: t / sum }
}

/** Normalize recency weights so they sum to 1 (all-zero → defaults). */
export function normalizeRecency(
  w: Pick<ScoringWeights, 'recencyY1' | 'recencyY2' | 'recencyY3'>,
): [number, number, number] {
  const vals = [w.recencyY1, w.recencyY2, w.recencyY3].map((v) => Math.max(0, v || 0))
  const sum = vals[0] + vals[1] + vals[2]
  if (sum === 0) return normalizeRecency(DEFAULT_WEIGHTS)
  return [vals[0] / sum, vals[1] / sum, vals[2] / sum]
}

/**
 * Composite Value score from grades and weights.
 * Grades that are not applicable (null) are dropped and the remaining weights
 * renormalized — e.g. DEF is scored on Player grade only.
 */
export function computeValue(grades: GradeSet, weights: ScoringWeights): ValueResult {
  const base = normalizeGradeWeights(weights)
  const gradeByKey: Record<GradeKey, number | null> = {
    player: grades.playerGrade,
    opportunity: grades.opportunityGrade,
    team: grades.teamGrade,
  }
  const keys: GradeKey[] = ['player', 'opportunity', 'team']
  const available = keys.filter((k) => gradeByKey[k] !== null)
  const availableSum = available.reduce((s, k) => s + base[k], 0)

  const applied: GradeWeights = { player: 0, opportunity: 0, team: 0 }
  for (const k of available) {
    applied[k] = availableSum > 0 ? base[k] / availableSum : 1 / available.length
  }

  const contributions: ValueContribution[] = keys.map((k) => {
    const grade = gradeByKey[k]
    return {
      key: k,
      label: GRADE_LABELS[k],
      grade,
      weight: applied[k],
      points: grade === null ? 0 : grade * applied[k],
    }
  })

  const rookieMultiplier = grades.isRookie ? ROOKIE_MULTIPLIER : 1
  const raw = contributions.reduce((s, c) => s + c.points, 0)

  return {
    valueScore: clamp(Math.round(raw * rookieMultiplier)),
    appliedWeights: applied,
    contributions,
    rookieMultiplier,
  }
}
