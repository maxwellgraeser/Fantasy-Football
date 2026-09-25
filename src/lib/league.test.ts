import { describe, it, expect } from 'vitest'
import {
  availablePlayerIds,
  buildTeams,
  findUserRoster,
  groupRoster,
  leaguePositions,
  leagueScoringLabel,
  pairMatchups,
  sortStandings,
} from './league'
import type { SleeperLeague, SleeperPlayer, SleeperPlayersMap, SleeperRoster } from '@/types/sleeper'

function league(overrides: Partial<SleeperLeague> = {}): SleeperLeague {
  return {
    league_id: 'L1',
    name: 'Test League',
    season: '2026',
    status: 'in_season',
    total_rosters: 2,
    avatar: null,
    roster_positions: ['QB', 'RB', 'WR', 'FLEX', 'DEF', 'BN', 'BN', 'IR'],
    scoring_settings: { rec: 0.5 },
    ...overrides,
  }
}

function roster(id: number, owner: string | null, overrides: Partial<SleeperRoster> = {}): SleeperRoster {
  return {
    roster_id: id,
    owner_id: owner,
    players: [],
    starters: [],
    reserve: null,
    taxi: null,
    settings: { wins: 0, losses: 0, ties: 0 },
    ...overrides,
  }
}

function player(id: string, pos: string, team: string | null = 'KC'): SleeperPlayer {
  return {
    player_id: id,
    first_name: 'P',
    last_name: id,
    position: pos,
    fantasy_positions: [pos as SleeperPlayer['fantasy_positions'][number]],
    team: team as SleeperPlayer['team'],
    status: 'Active',
    injury_status: null,
    years_exp: 3,
    age: 25,
    college: null,
    height: null,
    weight: null,
    number: null,
    depth_chart_position: null,
    depth_chart_order: null,
    search_rank: null,
  }
}

describe('leaguePositions', () => {
  it('expands flex slots and ignores bench/IR', () => {
    expect([...leaguePositions(league())].sort()).toEqual(['DEF', 'QB', 'RB', 'TE', 'WR'])
  })
})

describe('availablePlayerIds', () => {
  it('excludes rostered, reserve, free-agent-less and unused positions', () => {
    const players: SleeperPlayersMap = {
      a: player('a', 'QB'),
      b: player('b', 'RB'),
      c: player('c', 'WR'),
      d: player('d', 'TE', null), // no NFL team
      e: player('e', 'K'),        // league has no K slot
      f: player('f', 'TE'),
    }
    const rosters = [roster(1, 'u1', { players: ['a'], reserve: ['b'] }), roster(2, 'u2', { players: ['c'] })]
    expect(availablePlayerIds(league(), rosters, players)).toEqual(['f'])
  })
})

describe('groupRoster', () => {
  it('maps starters to slots and splits bench, IR and empty slots', () => {
    const r = roster(1, 'u1', {
      players: ['q', 'r', 'w', 'x', 'y'],
      starters: ['q', 'r', 'w', '0', 'y'],
      reserve: ['z'],
    })
    const g = groupRoster(league(), r)
    expect(g.starters).toEqual([
      { slot: 'QB', playerId: 'q' },
      { slot: 'RB', playerId: 'r' },
      { slot: 'WR', playerId: 'w' },
      { slot: 'FLEX', playerId: null },
      { slot: 'DEF', playerId: 'y' },
    ])
    expect(g.bench).toEqual(['x'])
    expect(g.reserve).toEqual(['z'])
  })
})

describe('findUserRoster', () => {
  it('matches owners and co-owners', () => {
    const rosters = [roster(1, 'u1'), roster(2, 'u2', { co_owners: ['u3'] })]
    expect(findUserRoster(rosters, 'u3')?.roster_id).toBe(2)
    expect(findUserRoster(rosters, 'nobody')).toBeUndefined()
  })
})

describe('standings', () => {
  it('combines decimal points and sorts by win % then points for', () => {
    const rosters = [
      roster(1, 'u1', { settings: { wins: 2, losses: 1, ties: 0, fpts: 300, fpts_decimal: 50 } }),
      roster(2, 'u2', { settings: { wins: 2, losses: 1, ties: 0, fpts: 310, fpts_decimal: 0 } }),
      roster(3, null, { settings: { wins: 3, losses: 0, ties: 0, fpts: 200 } }),
    ]
    const users = [
      { user_id: 'u1', username: 'a', display_name: 'Alice', avatar: null, metadata: { team_name: 'Aces' } },
      { user_id: 'u2', username: 'b', display_name: 'Bob', avatar: null },
    ]
    const teams = sortStandings(buildTeams(rosters, users))
    expect(teams.map((t) => t.teamName)).toEqual(['Team 3', 'Bob', 'Aces'])
    expect(teams[2].pointsFor).toBeCloseTo(300.5)
  })
})

describe('pairMatchups', () => {
  it('groups by matchup id and drops byes', () => {
    const pairs = pairMatchups([
      { roster_id: 1, matchup_id: 2, points: 100, starters: [] },
      { roster_id: 2, matchup_id: 1, points: 90, starters: [] },
      { roster_id: 3, matchup_id: 2, points: null, starters: [] },
      { roster_id: 4, matchup_id: 1, points: 80, starters: [] },
      { roster_id: 5, matchup_id: null, points: 0, starters: [] },
    ])
    expect(pairs.map((p) => p.matchupId)).toEqual([1, 2])
    expect(pairs[1].teams).toEqual([{ rosterId: 1, points: 100 }, { rosterId: 3, points: 0 }])
  })
})

describe('leagueScoringLabel', () => {
  it('reads points per reception', () => {
    expect(leagueScoringLabel(league({ scoring_settings: { rec: 1 } }))).toBe('PPR')
    expect(leagueScoringLabel(league())).toBe('Half PPR')
    expect(leagueScoringLabel(league({ scoring_settings: {} }))).toBe('Standard')
  })
})
