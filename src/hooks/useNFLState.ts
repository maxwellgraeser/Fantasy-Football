import { useQuery } from '@tanstack/react-query'
import { fetchNFLState } from '@/lib/sleeper'
import type { NFLState } from '@/types/sleeper'

export function useNFLState() {
  return useQuery<NFLState>({
    queryKey: ['nfl-state'],
    queryFn: fetchNFLState,
    staleTime: 60 * 60 * 1000,   // 1 hour
    retry: 2,
  })
}
