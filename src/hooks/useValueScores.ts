import { useMemo } from 'react'
import { usePlayers } from './usePlayers'
import { useMultiSeasonStats } from './useSeasonStats'
import { useSeasonStore } from '@/store/season'
import { useWeightsStore } from '@/store/weights'
import { buildPlayerRows } from '@/lib/scoring/composite'

/** Master hook: combines players + multi-season stats + weights → sorted PlayerRow array. */
export function useValueScores() {
  const { data: players, isLoading: playersLoading, error: playersError } = usePlayers()
  const { weights } = useWeightsStore()
  const { getSeasonsToLoad } = useSeasonStore()

  const seasons = getSeasonsToLoad()
  const seasonQueries = useMultiSeasonStats(seasons)

  const isLoading = playersLoading || seasonQueries.some((q) => q.query.isLoading)
  const error = playersError ?? seasonQueries.find((q) => q.query.error)?.query.error ?? null

  const rows = useMemo(() => {
    const primary = seasonQueries[0]
    if (!players || !primary?.query.data) return []

    const seasonStatsList = seasonQueries
      .filter((q) => q.query.data)
      .map((q) => ({ season: q.season, stats: q.query.data! }))

    return buildPlayerRows(players, seasonStatsList, weights)
  }, [players, weights, ...seasonQueries.map((q) => q.query.data)])

  return { rows, isLoading, error }
}
