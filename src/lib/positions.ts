import type { FantasyPosition, SleeperPlayer } from '@/types/sleeper'

/** Positions Min Max Fantasy scores. */
export const SCORED_POSITIONS: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE', 'DEF']

export function primaryPosition(player: Pick<SleeperPlayer, 'fantasy_positions'>): FantasyPosition | null {
  const pos = player.fantasy_positions?.[0]
  return pos && SCORED_POSITIONS.includes(pos) ? pos : null
}

export function playerName(player: Pick<SleeperPlayer, 'full_name' | 'first_name' | 'last_name'>): string {
  return player.full_name ?? `${player.first_name} ${player.last_name}`
}

export function positionBadgeClass(pos: string): string {
  const map: Record<string, string> = {
    QB:  'text-rose-300 bg-rose-950/50',
    RB:  'text-emerald-300 bg-emerald-950/50',
    WR:  'text-sky-300 bg-sky-950/50',
    TE:  'text-amber-300 bg-amber-950/50',
    DEF: 'text-violet-300 bg-violet-950/50',
  }
  return map[pos] ?? 'text-slate-400 bg-slate-800/50'
}

/** Sleeper height is inches as a string ("72") → 6'0". Passes through already-formatted values. */
export function formatHeight(height: string | null | undefined): string | null {
  if (!height) return null
  const inches = Number(height)
  if (!Number.isFinite(inches) || inches <= 0) return height
  return `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`
}
