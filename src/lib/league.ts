import type {
  SleeperLeague,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperPlayersMap,
  SleeperRoster,
} from '@/types/sleeper'

/** Roster slots that aren't starting spots. */
const NON_STARTER_SLOTS = new Set(['BN', 'IR', 'TAXI'])

export interface LeagueTeam {
  rosterId: number
  ownerId: string | null
  teamName: string
  ownerName: string
  avatar: string | null
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
}

function points(whole: number | undefined, decimal: number | undefined): number {
  return (whole ?? 0) + (decimal ?? 0) / 100
}

/** Joins rosters with their owners into display-ready teams (unsorted). */
export function buildTeams(rosters: SleeperRoster[], users: SleeperLeagueUser[]): LeagueTeam[] {
  const byId = new Map(users.map((u) => [u.user_id, u]))
  return rosters.map((r) => {
    const owner = r.owner_id ? byId.get(r.owner_id) : undefined
    const s = r.settings
    return {
      rosterId: r.roster_id,
      ownerId: r.owner_id,
      teamName: owner?.metadata?.team_name || owner?.display_name || `Team ${r.roster_id}`,
      ownerName: owner?.display_name ?? 'Unclaimed',
      avatar: owner?.avatar ?? null,
      wins: s.wins ?? 0,
      losses: s.losses ?? 0,
      ties: s.ties ?? 0,
      pointsFor: points(s.fpts, s.fpts_decimal),
      pointsAgainst: points(s.fpts_against, s.fpts_against_decimal),
    }
  })
}

/** Standings order: win % first, then points for. */
export function sortStandings(teams: LeagueTeam[]): LeagueTeam[] {
  const pct = (t: LeagueTeam) => {
    const games = t.wins + t.losses + t.ties
    return games ? (t.wins + t.ties / 2) / games : 0
  }
  return [...teams].sort((a, b) => pct(b) - pct(a) || b.pointsFor - a.pointsFor)
}

/** The roster the user owns or co-owns in this league. */
export function findUserRoster(rosters: SleeperRoster[], userId: string): SleeperRoster | undefined {
  return rosters.find((r) => r.owner_id === userId || r.co_owners?.includes(userId))
}

export interface StarterSlot {
  slot: string          // e.g. "QB", "FLEX", "SUPER_FLEX"
  playerId: string | null
}

/** Pairs each starting slot from the league settings with the player in it. */
export function starterSlots(league: SleeperLeague, roster: SleeperRoster): StarterSlot[] {
  const slots = league.roster_positions.filter((s) => !NON_STARTER_SLOTS.has(s))
  return slots.map((slot, i) => {
    const id = roster.starters?.[i]
    return { slot, playerId: id && id !== '0' ? id : null }
  })
}

export interface RosterGroups {
  starters: StarterSlot[]
  bench: string[]
  reserve: string[]
  taxi: string[]
}

export function groupRoster(league: SleeperLeague, roster: SleeperRoster): RosterGroups {
  const starters = starterSlots(league, roster)
  const reserve = roster.reserve ?? []
  const taxi = roster.taxi ?? []
  const notBench = new Set([...(roster.starters ?? []), ...reserve, ...taxi])
  const bench = (roster.players ?? []).filter((id) => !notBench.has(id))
  return { starters, bench, reserve, taxi }
}

/** Every player ID on any roster in the league (including IR and taxi). */
export function rosteredPlayerIds(rosters: SleeperRoster[]): Set<string> {
  const ids = new Set<string>()
  for (const r of rosters) {
    for (const list of [r.players, r.reserve, r.taxi]) list?.forEach((id) => ids.add(id))
  }
  return ids
}

/** Positions this league can start, e.g. FLEX expands to RB/WR/TE. */
export function leaguePositions(league: SleeperLeague): Set<string> {
  const expand: Record<string, string[]> = {
    FLEX: ['RB', 'WR', 'TE'],
    WRRB_FLEX: ['RB', 'WR'],
    REC_FLEX: ['WR', 'TE'],
    SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
    IDP_FLEX: ['DL', 'LB', 'DB'],
  }
  const out = new Set<string>()
  for (const slot of league.roster_positions) {
    if (NON_STARTER_SLOTS.has(slot)) continue
    for (const pos of expand[slot] ?? [slot]) out.add(pos)
  }
  return out
}

/**
 * Free agents: players on an NFL team, at a position the league uses,
 * who aren't on any roster in the league.
 */
export function availablePlayerIds(
  league: SleeperLeague,
  rosters: SleeperRoster[],
  players: SleeperPlayersMap,
): string[] {
  const taken = rosteredPlayerIds(rosters)
  const positions = leaguePositions(league)
  const out: string[] = []
  for (const p of Object.values(players)) {
    if (!p.team || taken.has(p.player_id)) continue
    const pos = p.fantasy_positions?.[0]
    if (pos && positions.has(pos)) out.push(p.player_id)
  }
  return out
}

/** Short scoring label from the league's points-per-reception setting. */
export function leagueScoringLabel(league: SleeperLeague): string {
  const rec = league.scoring_settings?.rec ?? 0
  if (rec >= 1) return 'PPR'
  if (rec >= 0.5) return 'Half PPR'
  return 'Standard'
}

export interface MatchupPair {
  matchupId: number
  teams: { rosterId: number; points: number }[]
}

/** Groups a week's matchup rows into head-to-head pairs (byes dropped). */
export function pairMatchups(matchups: SleeperMatchup[]): MatchupPair[] {
  const byId = new Map<number, MatchupPair>()
  for (const m of matchups) {
    if (m.matchup_id == null) continue
    const pair = byId.get(m.matchup_id) ?? { matchupId: m.matchup_id, teams: [] }
    pair.teams.push({ rosterId: m.roster_id, points: m.points ?? 0 })
    byId.set(m.matchup_id, pair)
  }
  return [...byId.values()].sort((a, b) => a.matchupId - b.matchupId)
}
