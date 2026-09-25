import { createContext, useContext } from 'react'
import type { PlayerRow, ScoringFormat } from '@/types/scoring'
import type { SeasonContext } from './useSeasonContext'

export interface ValueScoresState {
  /** Eligible players with Value scores, sorted by Value (desc). Shared across pages. */
  rows: PlayerRow[]
  isLoading: boolean
  error: Error | null
  season: SeasonContext
  /** Games played so far in the selected season (17 once complete); null while its stats load. */
  gamesInSelectedSeason: number | null
  scoringFormat: ScoringFormat
  /** True while a weights/format change is being applied in the background. */
  isRecomputing: boolean
}

export const ValueScoresContext = createContext<ValueScoresState | null>(null)

/** Shared scoring state — computed once in <ScoresProvider>. */
export function useValueScores(): ValueScoresState {
  const ctx = useContext(ValueScoresContext)
  if (!ctx) throw new Error('useValueScores must be used inside <ScoresProvider>')
  return ctx
}
