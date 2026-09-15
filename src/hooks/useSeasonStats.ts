import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchSeasonStats } from '@/lib/sleeper'
import { getCachedStats, setCachedStats } from '@/lib/cache'
import type { SleeperSeasonStats } from '@/types/sleeper'

/** Query options for one season's stats, with IndexedDB caching. */
export function seasonStatsQuery(season: string) {
  return queryOptions<SleeperSeasonStats>({
    queryKey: ['stats', season],
    queryFn: async () => {
      const cached = await getCachedStats<SleeperSeasonStats>(season)
      if (cached) return cached
      const data = await fetchSeasonStats(season)
      await setCachedStats(season, data)
      return data
    },
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  })
}

export function useSeasonStats(season: string | null) {
  return useQuery({ ...seasonStatsQuery(season ?? ''), enabled: !!season })
}
