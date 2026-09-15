import type { SleeperPlayer, SleeperSeasonStats } from '@/types/sleeper'
import { primaryPosition } from '@/lib/positions'

/**
 * Whether a player belongs in the tables and search.
 * Sleeper marks many retired players `status: "Active"` with `team: null`, so we keep
 * a scored-position player only if they're on a team or recorded games in the
 * selected season or the one before.
 */
export function isEligiblePlayer(
  player: SleeperPlayer,
  selectedStats: SleeperSeasonStats | undefined,
  previousStats: SleeperSeasonStats | undefined,
): boolean {
  if (!primaryPosition(player)) return false
  if (player.team) return true
  const gp = (stats: SleeperSeasonStats | undefined) => stats?.[player.player_id]?.gp ?? 0
  return gp(selectedStats) > 0 || gp(previousStats) > 0
}
