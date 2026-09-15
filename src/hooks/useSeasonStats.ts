import { useQuery } from '@tanstack/react-query'
import { fetchSeasonStats } from '@/lib/sleeper'
import { getCachedStats, setCachedStats } from '@/lib/cache'
import type { SleeperSeasonStats } from '@/types/sleeper'

/** Fetches season stats with IndexedDB caching. */
export function useSeasonStats(season: string | null) {
  return useQuery<SleeperSeasonStats>({
    queryKey: ['stats', season],
    enabled: !!season,
    queryFn: async () => {
      if (!season) throw new Error('No season')
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

/** Load multiple seasons in a single hook — returns map keyed by season string. */
export function useMultiSeasonStats(seasons: string[]) {
  return seasons.map((s) => ({
    season: s,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    query: useSeasonStats(s),
  }))
}
