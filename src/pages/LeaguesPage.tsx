import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAccountStore } from '@/store/account'
import { useNFLState } from '@/hooks/useNFLState'
import { usePlayers } from '@/hooks/usePlayers'
import { useValueScores } from '@/hooks/useValueScores'
import {
  sleeperUserQuery,
  useLeagueMatchups,
  useLeagueRosters,
  useLeagueUsers,
  useSleeperUser,
  useUserLeagues,
} from '@/hooks/useSleeperLeagues'
import { avatarUrl } from '@/lib/sleeper'
import {
  availablePlayerIds,
  buildTeams,
  findUserRoster,
  groupRoster,
  leaguePositions,
  leagueScoringLabel,
  pairMatchups,
  sortStandings,
  type LeagueTeam,
} from '@/lib/league'
import { positionBadgeClass, playerName } from '@/lib/positions'
import type { PlayerRow } from '@/types/scoring'
import type { SleeperLeague, SleeperPlayersMap, SleeperRoster } from '@/types/sleeper'

type Tab = 'team' | 'available' | 'standings' | 'matchups'

const TABS: { id: Tab; label: string }[] = [
  { id: 'team', label: 'My Team' },
  { id: 'available', label: 'Available' },
  { id: 'standings', label: 'Standings' },
  { id: 'matchups', label: 'Matchups' },
]

const AVAILABLE_LIMIT = 50

function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-800/40 rounded animate-pulse" />
      ))}
    </div>
  )
}

function Message({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <div className={`flex items-center justify-center h-40 text-center text-sm ${tone === 'error' ? 'text-red-400' : 'text-slate-500'}`}>
      {children}
    </div>
  )
}

function Avatar({ id, size = 'h-8 w-8' }: { id: string | null; size?: string }) {
  if (!id) return <div className={`${size} rounded-full bg-slate-800 shrink-0`} />
  return <img src={avatarUrl(id)} alt="" className={`${size} rounded-full shrink-0 bg-slate-800`} />
}

// ─── Connect ─────────────────────────────────────────────────────────────────

function ConnectForm() {
  const connect = useAccountStore((s) => s.connect)
  const queryClient = useQueryClient()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const username = value.trim()
    if (!username) return
    setPending(true)
    setError(null)
    try {
      const user = await queryClient.fetchQuery(sleeperUserQuery(username))
      if (user) connect(username)
      else setError(`No Sleeper account found for "${username}".`)
    } catch {
      setError('Could not reach Sleeper. Try again in a moment.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-12 rounded-lg border border-slate-800 bg-slate-900/40 p-6">
      <h1 className="text-lg font-bold text-white">Connect your Sleeper account</h1>
      <p className="mt-1 text-sm text-slate-400">
        Enter your Sleeper username to see your leagues, rosters, standings and available players.
        It's saved in this browser only. Sleeper data is read-only, so no password is needed.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Sleeper username"
          aria-label="Sleeper username"
          autoComplete="username"
          className="flex-1 min-w-0 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm
            text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-500
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {pending ? 'Checking…' : 'Connect'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}

// ─── Player line ─────────────────────────────────────────────────────────────

function PlayerLine({
  playerId,
  slot,
  players,
  rowsById,
}: {
  playerId: string | null
  slot?: string
  players: SleeperPlayersMap | undefined
  rowsById: Map<string, PlayerRow>
}) {
  const p = playerId ? players?.[playerId] : undefined
  const row = playerId ? rowsById.get(playerId) : undefined
  const pos = p?.fantasy_positions?.[0] ?? p?.position ?? '—'
  const name = p ? playerName(p) : playerId ? `Player ${playerId}` : 'Empty'

  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {slot && <span className="w-14 shrink-0 text-[11px] font-semibold text-slate-500 uppercase">{slot.replace('_', ' ')}</span>}
      <span className={`w-9 text-center text-[10px] font-semibold px-1 py-0.5 rounded shrink-0 ${positionBadgeClass(pos)}`}>
        {pos}
      </span>
      <div className="flex-1 min-w-0">
        {row ? (
          <Link to={`/player/${row.playerId}`} className="text-sm text-slate-200 hover:text-violet-300 truncate block">
            {name}
          </Link>
        ) : (
          <span className={`text-sm truncate block ${playerId ? 'text-slate-300' : 'text-slate-600 italic'}`}>{name}</span>
        )}
        {p && (
          <span className="text-xs text-slate-500">
            {p.team ?? 'FA'}
            {p.injury_status && <span className="ml-1.5 text-amber-400">{p.injury_status}</span>}
          </span>
        )}
      </div>
      {row?.seasonPpg != null && (
        <span className="hidden sm:inline text-xs text-slate-500 tabular-nums shrink-0">{row.seasonPpg.toFixed(1)} PPG</span>
      )}
      <span className="w-8 text-right text-sm font-mono tabular-nums text-slate-300 shrink-0">
        {row ? row.scores.valueScore : ''}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="rounded-lg border border-slate-800 divide-y divide-slate-800/50">{children}</div>
    </div>
  )
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function MyTeamTab({
  league,
  roster,
  players,
  rowsById,
}: {
  league: SleeperLeague
  roster: SleeperRoster | undefined
  players: SleeperPlayersMap | undefined
  rowsById: Map<string, PlayerRow>
}) {
  if (!roster) return <Message>You don't have a team in this league.</Message>
  const g = groupRoster(league, roster)
  const line = (id: string | null, slot?: string, key?: string) => (
    <PlayerLine key={key ?? id ?? slot} playerId={id} slot={slot} players={players} rowsById={rowsById} />
  )
  return (
    <div className="space-y-5">
      <Section title="Starters">{g.starters.map((s, i) => line(s.playerId, s.slot, `${s.slot}-${i}`))}</Section>
      {g.bench.length > 0 && <Section title="Bench">{g.bench.map((id) => line(id))}</Section>}
      {g.reserve.length > 0 && <Section title="IR">{g.reserve.map((id) => line(id))}</Section>}
      {g.taxi.length > 0 && <Section title="Taxi">{g.taxi.map((id) => line(id))}</Section>}
    </div>
  )
}

function AvailableTab({
  league,
  rosters,
  players,
  rowsById,
}: {
  league: SleeperLeague
  rosters: SleeperRoster[]
  players: SleeperPlayersMap | undefined
  rowsById: Map<string, PlayerRow>
}) {
  const positions = useMemo(() => [...leaguePositions(league)], [league])
  const [pos, setPos] = useState<string>('ALL')

  const available = useMemo(() => {
    if (!players) return []
    const ids = availablePlayerIds(league, rosters, players)
      .filter((id) => pos === 'ALL' || players[id].fantasy_positions?.[0] === pos)
    // Scored players by Value; everyone else (K, IDP) after, by Sleeper rank.
    const rank = (id: string) => players[id].search_rank ?? Number.MAX_SAFE_INTEGER
    return ids
      .sort((a, b) => {
        const va = rowsById.get(a)?.scores.valueScore ?? -1
        const vb = rowsById.get(b)?.scores.valueScore ?? -1
        return vb - va || rank(a) - rank(b)
      })
      .slice(0, AVAILABLE_LIMIT)
  }, [league, rosters, players, rowsById, pos])

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {['ALL', ...positions].map((p) => (
          <button
            key={p}
            onClick={() => setPos(p)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
              ${pos === p ? 'bg-slate-700/70 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
          >
            {p === 'ALL' ? 'All' : p}
          </button>
        ))}
      </div>
      {available.length === 0 ? (
        <Message>No available players at this position.</Message>
      ) : (
        <>
          <div className="rounded-lg border border-slate-800 divide-y divide-slate-800/50">
            {available.map((id) => (
              <PlayerLine key={id} playerId={id} players={players} rowsById={rowsById} />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Top {AVAILABLE_LIMIT} unrostered players on an NFL team, ranked by Value.
          </p>
        </>
      )}
    </div>
  )
}

function StandingsTab({ teams, myRosterId }: { teams: LeagueTeam[]; myRosterId: number | undefined }) {
  const sorted = sortStandings(teams)
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <th className="px-3 py-2.5 w-8">#</th>
            <th className="px-3 py-2.5">Team</th>
            <th className="px-3 py-2.5 text-right">Record</th>
            <th className="px-3 py-2.5 text-right">PF</th>
            <th className="px-3 py-2.5 text-right">PA</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => (
            <tr
              key={t.rosterId}
              className={`border-b border-slate-800/50 ${t.rosterId === myRosterId ? 'bg-violet-950/30' : ''}`}
            >
              <td className="px-3 py-2 text-xs text-slate-500 tabular-nums">{i + 1}</td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar id={t.avatar} size="h-6 w-6" />
                  <div className="min-w-0">
                    <div className="text-slate-200 truncate">{t.teamName}</div>
                    {t.teamName !== t.ownerName && <div className="text-xs text-slate-500 truncate">{t.ownerName}</div>}
                  </div>
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-300 whitespace-nowrap">
                {t.wins}-{t.losses}{t.ties ? `-${t.ties}` : ''}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-300">{t.pointsFor.toFixed(1)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-500">{t.pointsAgainst.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MatchupsTab({
  leagueId,
  week,
  teams,
  myRosterId,
}: {
  leagueId: string
  week: number
  teams: LeagueTeam[]
  myRosterId: number | undefined
}) {
  const matchups = useLeagueMatchups(leagueId, week)
  if (week < 1) return <Message>Matchups start in week 1.</Message>
  if (matchups.isLoading) return <Skeleton rows={4} />
  if (matchups.error) return <Message tone="error">Couldn't load matchups from Sleeper.</Message>

  const byRoster = new Map(teams.map((t) => [t.rosterId, t]))
  const pairs = pairMatchups(matchups.data ?? [])
  // Put the user's own matchup first.
  pairs.sort((a, b) => Number(b.teams.some((t) => t.rosterId === myRosterId)) - Number(a.teams.some((t) => t.rosterId === myRosterId)))

  if (pairs.length === 0) return <Message>No matchups for week {week}.</Message>

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Week {week}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {pairs.map((pair) => {
          const mine = pair.teams.some((t) => t.rosterId === myRosterId)
          const top = Math.max(...pair.teams.map((t) => t.points))
          return (
            <div
              key={pair.matchupId}
              className={`rounded-lg border divide-y divide-slate-800/50 ${mine ? 'border-violet-700/60' : 'border-slate-800'}`}
            >
              {pair.teams.map((side) => {
                const team = byRoster.get(side.rosterId)
                const leading = side.points === top && side.points > 0
                return (
                  <div key={side.rosterId} className="flex items-center gap-2.5 px-3 py-2">
                    <Avatar id={team?.avatar ?? null} size="h-6 w-6" />
                    <span className={`flex-1 min-w-0 truncate text-sm ${side.rosterId === myRosterId ? 'text-white font-medium' : 'text-slate-300'}`}>
                      {team?.teamName ?? `Team ${side.rosterId}`}
                    </span>
                    <span className={`text-sm font-mono tabular-nums ${leading ? 'text-emerald-300' : 'text-slate-400'}`}>
                      {side.points.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── League view ─────────────────────────────────────────────────────────────

function LeagueView({ league, userId, week }: { league: SleeperLeague; userId: string; week: number }) {
  const [tab, setTab] = useState<Tab>('team')
  const rosters = useLeagueRosters(league.league_id)
  const users = useLeagueUsers(league.league_id)
  const players = usePlayers()
  const { rows } = useValueScores()
  const rowsById = useMemo(() => new Map(rows.map((r) => [r.playerId, r])), [rows])

  const teams = useMemo(
    () => (rosters.data && users.data ? buildTeams(rosters.data, users.data) : []),
    [rosters.data, users.data],
  )
  const myRoster = rosters.data ? findUserRoster(rosters.data, userId) : undefined

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-800 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors
              ${tab === t.id ? 'border-violet-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rosters.isLoading || users.isLoading || players.isLoading ? (
        <Skeleton />
      ) : rosters.error || users.error || players.error ? (
        <Message tone="error">Couldn't load this league from Sleeper.</Message>
      ) : tab === 'team' ? (
        <MyTeamTab league={league} roster={myRoster} players={players.data} rowsById={rowsById} />
      ) : tab === 'available' ? (
        <AvailableTab league={league} rosters={rosters.data ?? []} players={players.data} rowsById={rowsById} />
      ) : tab === 'standings' ? (
        <StandingsTab teams={teams} myRosterId={myRoster?.roster_id} />
      ) : (
        <MatchupsTab leagueId={league.league_id} week={week} teams={teams} myRosterId={myRoster?.roster_id} />
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function LeaguesPage() {
  const { username, selectedLeagueId, selectLeague, disconnect } = useAccountStore()
  const nfl = useNFLState()
  const user = useSleeperUser(username)
  const season = nfl.data ? nfl.data.league_season || nfl.data.season : undefined
  const leagues = useUserLeagues(user.data?.user_id, season)

  if (!username) return <ConnectForm />

  const list = leagues.data ?? []
  const league = list.find((l) => l.league_id === selectedLeagueId) ?? list[0]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {user.data && <Avatar id={user.data.avatar} />}
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white leading-tight">My Leagues</h1>
          <p className="text-xs text-slate-500 truncate">
            {user.data?.display_name ?? username}
            {season && ` · ${season} season`}
          </p>
        </div>
        <div className="flex-1" />
        <button onClick={disconnect} className="text-xs text-slate-500 hover:text-red-400 transition-colors">
          Disconnect
        </button>
      </div>

      {user.isLoading || nfl.isLoading || leagues.isLoading ? (
        <Skeleton />
      ) : user.error || nfl.error || leagues.error ? (
        <Message tone="error">Couldn't reach Sleeper. Try again in a moment.</Message>
      ) : !user.data ? (
        <Message>
          No Sleeper account found for "{username}".{' '}
          <button onClick={disconnect} className="ml-1 text-violet-400 hover:text-violet-300">Use a different username</button>
        </Message>
      ) : !league ? (
        <Message>No {season} leagues found for this account.</Message>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <label className="sr-only" htmlFor="league-select">League</label>
            <select
              id="league-select"
              value={league.league_id}
              onChange={(e) => selectLeague(e.target.value)}
              className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200
                focus:outline-none focus:border-violet-500 max-w-full"
            >
              {list.map((l) => (
                <option key={l.league_id} value={l.league_id}>{l.name}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              {league.total_rosters} teams · {leagueScoringLabel(league)}
            </span>
          </div>
          <LeagueView key={league.league_id} league={league} userId={user.data.user_id} week={nfl.data?.week ?? 0} />
        </>
      )}
    </div>
  )
}
