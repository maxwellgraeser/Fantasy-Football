import { useDeferredValue, useMemo, type ReactNode } from 'react'
import { useQueries, type UseQueryResult } from '@tanstack/react-query'
import { usePlayers } from '@/hooks/usePlayers'
import { useSeasonContext } from '@/hooks/useSeasonContext'
import { seasonStatsQuery } from '@/hooks/useSeasonStats'
import { ValueScoresContext, type ValueScoresState } from '@/hooks/useValueScores'
import { useSettingsStore } from '@/store/settings'
import { useWeightsStore } from '@/store/weights'
import { applyWeights, buildGradedRows } from '@/lib/scoring/composite'
import { seasonGamesPlayed } from '@/lib/scoring/teamGrade'
import type { SleeperSeasonStats } from '@/types/sleeper'

function combineStats(results: UseQueryResult<SleeperSeasonStats>[]) {
  return {
    data: results.map((r) => r.data),
    isLoading: results.some((r) => r.isLoading),
    error: results.find((r) => r.error)?.error ?? null,
  }
}

/** Computes Value scores once for the whole app. */
export function ScoresProvider({ children }: { children: ReactNode }) {
  const season = useSeasonContext()
  const players = usePlayers()
  const scoringFormat = useSettingsStore((s) => s.scoringFormat)
  const weights = useWeightsStore((s) => s.weights)

  // Keep the UI responsive while sliders/toggles change
  const deferredWeights = useDeferredValue(weights)
  const deferredFormat = useDeferredValue(scoringFormat)

  const stats = useQueries({
    queries: season.isReady ? season.seasonsToLoad.map((s) => seasonStatsQuery(s)) : [],
    combine: combineStats,
  })

  const {
    recencyY1, recencyY2, recencyY3,
    playerWPpg, playerWAge, playerWDurability,
    oppWDepthChart, oppWTargetShare, oppWTouchShare, oppWRoleSteadiness,
  } = deferredWeights
  const { seasonsToLoad, inProgressSeason, latestSeason } = season

  const graded = useMemo(() => {
    if (!players.data || stats.isLoading || !stats.data[0]) return []
    const seasonStatsList = seasonsToLoad.map((s, i) => ({ season: s, stats: stats.data[i] ?? {} }))
    return buildGradedRows(players.data, seasonStatsList, {
      recency: { recencyY1, recencyY2, recencyY3 },
      playerWeights: { playerWPpg, playerWAge, playerWDurability },
      opportunityWeights: { oppWDepthChart, oppWTargetShare, oppWTouchShare, oppWRoleSteadiness },
      format: deferredFormat,
      inProgressSeason,
      latestSeason,
    })
  }, [players.data, stats.isLoading, stats.data, seasonsToLoad, inProgressSeason, latestSeason,
      recencyY1, recencyY2, recencyY3, playerWPpg, playerWAge, playerWDurability,
      oppWDepthChart, oppWTargetShare, oppWTouchShare, oppWRoleSteadiness, deferredFormat])

  const rows = useMemo(() => applyWeights(graded, deferredWeights), [graded, deferredWeights])

  const selectedStats = stats.data[0]
  const gamesInSelectedSeason = useMemo(
    () => (selectedStats ? seasonGamesPlayed(selectedStats) : 0),
    [selectedStats],
  )

  const value = useMemo<ValueScoresState>(() => ({
    rows,
    isLoading: !season.isReady || players.isLoading || stats.isLoading,
    error: players.error ?? stats.error ?? null,
    season,
    gamesInSelectedSeason,
    scoringFormat,
    isRecomputing: weights !== deferredWeights || scoringFormat !== deferredFormat,
  }), [rows, season, players.isLoading, players.error, stats.isLoading, stats.error,
      gamesInSelectedSeason, scoringFormat, weights, deferredWeights, deferredFormat])

  return <ValueScoresContext.Provider value={value}>{children}</ValueScoresContext.Provider>
}
