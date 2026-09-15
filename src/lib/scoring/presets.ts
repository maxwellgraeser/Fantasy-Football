import type { ScoringWeights } from '@/types/scoring'
import { DEFAULT_WEIGHTS } from '@/types/scoring'
import { normalizeGradeWeights, normalizeRecency } from './value'

export interface WeightPreset {
  key: string
  label: string
  /** Shown as a tooltip / caption under the preset chip. */
  description: string
  weights: Pick<ScoringWeights, 'wPlayer' | 'wOpportunity' | 'wTeam'>
}

/** Grade-weight presets shown as chips above the split bar. Order matches the plan. */
export const WEIGHT_PRESETS: WeightPreset[] = [
  {
    key: 'balanced',
    label: 'Balanced',
    description: 'The default mix — production leads, with role and team context in support.',
    weights: { wPlayer: 0.55, wOpportunity: 0.20, wTeam: 0.25 },
  },
  {
    key: 'production',
    label: 'Proven production',
    description: 'Leans hard on track record; role and team context matter less.',
    weights: { wPlayer: 0.75, wOpportunity: 0.10, wTeam: 0.15 },
  },
  {
    key: 'opportunity',
    label: 'Opportunity chaser',
    description: 'Chases volume and role — good for finding breakout candidates.',
    weights: { wPlayer: 0.35, wOpportunity: 0.45, wTeam: 0.20 },
  },
  {
    key: 'offense',
    label: 'Offense matters',
    description: 'Weights the surrounding offense as heavily as raw production.',
    weights: { wPlayer: 0.40, wOpportunity: 0.20, wTeam: 0.40 },
  },
]

const pctEq = (a: number, b: number) => Math.round(a * 100) === Math.round(b * 100)

/** Whether the given weights' normalized grade split matches this preset (rounded to whole %). */
export function matchesPreset(weights: ScoringWeights, preset: WeightPreset): boolean {
  const a = normalizeGradeWeights(weights)
  const b = normalizeGradeWeights(preset.weights)
  return pctEq(a.player, b.player) && pctEq(a.opportunity, b.opportunity) && pctEq(a.team, b.team)
}

/**
 * True when both the grade weights and recency weights match the shipped defaults, once
 * normalized. Persisted weights from older app versions may not sum to 1 (or to the same
 * ratios) even when they were "left at default", so compare normalized values rather than
 * raw fields.
 */
export function isDefaultWeights(weights: ScoringWeights): boolean {
  const g = normalizeGradeWeights(weights)
  const dg = normalizeGradeWeights(DEFAULT_WEIGHTS)
  const r = normalizeRecency(weights)
  const dr = normalizeRecency(DEFAULT_WEIGHTS)
  return (
    pctEq(g.player, dg.player) &&
    pctEq(g.opportunity, dg.opportunity) &&
    pctEq(g.team, dg.team) &&
    pctEq(r[0], dr[0]) &&
    pctEq(r[1], dr[1]) &&
    pctEq(r[2], dr[2])
  )
}
