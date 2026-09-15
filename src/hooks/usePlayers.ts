import { useQuery } from '@tanstack/react-query'
import { fetchAllPlayers } from '@/lib/sleeper'
import { getCachedPlayers, setCachedPlayers } from '@/lib/cache'
import type { SleeperPlayersMap } from '@/types/sleeper'

export function usePlayers() {
  return useQuery<SleeperPlayersMap>({
    queryKey: ['players'],
    queryFn: async () => {
      // 1. Try IndexedDB cache first
      const cached = await getCachedPlayers<SleeperPlayersMap>()
      if (cached) return cached

      // 2. Fetch from Sleeper
      const data = await fetchAllPlayers()
      await setCachedPlayers(data)
      return data
    },
    staleTime: 24 * 60 * 60 * 1000,   // 24h
    gcTime: 48 * 60 * 60 * 1000,       // keep in memory 48h
    retry: 2,
  })
}
