import type { FantasyPosition } from '@/types/sleeper'
import type { GradeKey, GradeWeights, ScoringFormat } from '@/types/scoring'
import { ROOKIE_MULTIPLIER } from './value'
import { SCORING_FORMAT_LABELS } from './format'

export interface GradePart {
  label: string
  weight: number   // share of the grade, 0–1
  detail: string
}

export interface GradeExplanation {
  title: string
  short: string
  parts: GradePart[]
}

/** Plain-language descriptions of what feeds each grade. Keep in sync with lib/scoring. */
export const GRADE_EXPLANATIONS: Record<GradeKey, GradeExplanation> = {
  player: {
    title: 'Player Grade',
    short: 'Production vs. same-position players: fantasy PPG, age-adjusted production, durability.',
    parts: [
      { label: 'PPG percentile', weight: 0.55, detail: 'Recency-weighted fantasy PPG over the last 3 seasons, as a percentile vs. the position.' },
      { label: 'Age-adjusted production', weight: 0.20, detail: 'PPG percentile minus an age-curve penalty for players past (or well before) their position’s peak.' },
      { label: 'Durability', weight: 0.25, detail: 'Share of team games played, averaged over recent seasons.' },
    ],
  },
  opportunity: {
    title: 'Opportunity Grade',
    short: 'Role and volume: depth chart, target volume, touch volume, games played.',
    parts: [
      { label: 'Depth chart', weight: 0.35, detail: 'Starter = 90, backup = 55, third string = 25.' },
      { label: 'Target volume', weight: 0.25, detail: 'Targets in the selected season, percentile vs. the position.' },
      { label: 'Touch volume', weight: 0.25, detail: 'Carries + receptions, percentile vs. the position.' },
      { label: 'Games played', weight: 0.15, detail: 'Games played, percentile vs. the position.' },
    ],
  },
  team: {
    title: 'Team Grade',
    short: 'Offensive context for the player’s position, graded against the other 31 teams.',
    parts: [],
  },
}

export const TEAM_CONTEXT_BY_POSITION: Partial<Record<FantasyPosition, string>> = {
  QB: 'Plays per game, pass attempts, pass yards, red-zone TD rate, sack rate (lower is better).',
  RB: 'Rush attempts, rush yards, red-zone rush share, yards per carry, red-zone TD rate.',
  WR: 'Pass attempts, pass yards, pass rate, red-zone targets, air yards.',
  TE: 'Pass attempts, pass yards, pass rate, red-zone targets, air yards.',
}

export const ROOKIE_NOTE = `Rookies × ${ROOKIE_MULTIPLIER} while provisional (no completed NFL season before the selected one).`

export const DEF_NOTE = 'Defenses are scored on Player Grade only (fantasy PPG percentile vs. other defenses); Opportunity and Team don’t apply.'

const pct = (w: number) => `${Math.round(w * 100)}%`

/** "Player × 55% + Opportunity × 20% + Team × 25%" */
export function valueFormulaText(weights: GradeWeights): string {
  return `Player × ${pct(weights.player)} + Opportunity × ${pct(weights.opportunity)} + Team × ${pct(weights.team)}`
}

export function ppgDescription(season: string, format: ScoringFormat, inProgress: boolean): string {
  return `${SCORING_FORMAT_LABELS[format]} fantasy points per game in ${season}${inProgress ? ' (season to date)' : ''}.`
}
