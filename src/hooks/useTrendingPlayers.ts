import { useQuery } from '@tanstack/react-query'
import { fetchTrendingPlayers } from '@/lib/sleeper'
import type { TrendingPlayer } from '@/types/sleeper'

/** Players being added (or dropped) across Sleeper leagues in the last `lookbackHours`. */
export function useTrendingPlayers(type: 'add' | 'drop', lookbackHours = 24, limit = 25) {
  return useQuery<TrendingPlayer[]>({
    queryKey: ['trending', type, lookbackHours, limit],
    queryFn: () => fetchTrendingPlayers(type, lookbackHours, limit),
    staleTime: 15 * 60 * 1000,   // 15m — waiver trends shift through the day
    gcTime: 60 * 60 * 1000,
    retry: 2,
  })
}
