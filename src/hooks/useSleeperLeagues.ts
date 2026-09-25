import { useQuery } from '@tanstack/react-query'
import {
  fetchUser,
  fetchUserLeagues,
  fetchLeagueUsers,
  fetchLeagueRosters,
  fetchLeagueMatchups,
} from '@/lib/sleeper'
import type {
  SleeperUser,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperRoster,
  SleeperMatchup,
} from '@/types/sleeper'

export const sleeperUserQuery = (username: string) => ({
  queryKey: ['sleeper-user', username.toLowerCase()],
  queryFn: () => fetchUser(username),
  staleTime: 60 * 60 * 1000,
})

export function useSleeperUser(username: string | null) {
  return useQuery<SleeperUser | null>({
    ...sleeperUserQuery(username ?? ''),
    enabled: !!username,
  })
}

export function useUserLeagues(userId: string | undefined, season: string | undefined) {
  return useQuery<SleeperLeague[]>({
    queryKey: ['sleeper-leagues', userId, season],
    queryFn: () => fetchUserLeagues(userId!, season!),
    enabled: !!userId && !!season,
    staleTime: 60 * 60 * 1000,
  })
}

export function useLeagueUsers(leagueId: string | undefined) {
  return useQuery<SleeperLeagueUser[]>({
    queryKey: ['sleeper-league-users', leagueId],
    queryFn: () => fetchLeagueUsers(leagueId!),
    enabled: !!leagueId,
    staleTime: 60 * 60 * 1000,
  })
}

export function useLeagueRosters(leagueId: string | undefined) {
  return useQuery<SleeperRoster[]>({
    queryKey: ['sleeper-league-rosters', leagueId],
    queryFn: () => fetchLeagueRosters(leagueId!),
    enabled: !!leagueId,
    staleTime: 5 * 60 * 1000,   // rosters change with waivers/trades
  })
}

export function useLeagueMatchups(leagueId: string | undefined, week: number | undefined) {
  return useQuery<SleeperMatchup[]>({
    queryKey: ['sleeper-league-matchups', leagueId, week],
    queryFn: () => fetchLeagueMatchups(leagueId!, week!),
    enabled: !!leagueId && !!week && week > 0,
    staleTime: 5 * 60 * 1000,
  })
}
