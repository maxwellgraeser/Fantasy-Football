import { useParams, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { usePlayers } from '@/hooks/usePlayers'
import { useValueScores } from '@/hooks/useValueScores'
import { playerImageUrl } from '@/lib/sleeper'
import { ValueScoreBadge } from '@/components/ValueScoreBadge'
import { TeamGradeChip } from '@/components/TeamGradeChip'
import { ScoreBreakdown } from '@/components/ScoreBreakdown'
import { positionBadgeClass, playerName, primaryPosition, formatHeight } from '@/lib/positions'
import { SCORING_FORMAT_LABELS } from '@/lib/scoring/format'
import { useWatchlistStore } from '@/store/watchlist'
import type { SleeperPlayer, SleeperPlayerStats } from '@/types/sleeper'
import type { FantasyPosition } from '@/types/sleeper'

type StatColumn = {
  label: string
  value: (raw: SleeperPlayerStats | undefined, gp: number) => string
}

function perGame(val: number | undefined, gp: number, decimals = 1): string {
  if (!val || gp === 0) return '—'
  return (val / gp).toFixed(decimals)
}

function statColumnsForPosition(pos: FantasyPosition): StatColumn[] {
  switch (pos) {
    case 'QB':
      return [
        { label: 'Pass Yd/G', value: (r, gp) => perGame(r?.pass_yd, gp) },
        { label: 'Pass TD/G', value: (r, gp) => perGame(r?.pass_td, gp, 2) },
        { label: 'Rush Yd/G', value: (r, gp) => perGame(r?.rush_yd, gp) },
        { label: 'INT/G',     value: (r, gp) => perGame(r?.pass_int, gp, 2) },
      ]
    case 'RB':
      return [
        { label: 'Rush Yd/G', value: (r, gp) => perGame(r?.rush_yd, gp) },
        { label: 'Rush TD/G', value: (r, gp) => perGame(r?.rush_td, gp, 2) },
        { label: 'Rec/G',     value: (r, gp) => perGame(r?.rec, gp, 1) },
        { label: 'Rec Yd/G', value: (r, gp) => perGame(r?.rec_yd, gp) },
      ]
    case 'WR':
    case 'TE':
      return [
        { label: 'Tgt/G',    value: (r, gp) => perGame(r?.rec_tgt, gp, 1) },
        { label: 'Rec/G',    value: (r, gp) => perGame(r?.rec, gp, 1) },
        { label: 'Rec Yd/G', value: (r, gp) => perGame(r?.rec_yd, gp) },
        { label: 'Rec TD/G', value: (r, gp) => perGame(r?.rec_td, gp, 2) },
      ]
    case 'DEF':
      return [
        { label: 'Sack/G',   value: (r, gp) => perGame(r?.sack, gp, 1) },
        { label: 'INT/G',    value: (r, gp) => perGame(r?.int, gp, 2) },
        { label: 'TD/G',     value: (r, gp) => perGame(r?.def_td, gp, 2) },
        { label: 'Pts Allow/G', value: (r, gp) => perGame(r?.pts_allow, gp, 1) },
      ]
    default:
      return []
  }
}

/** Season label with an explicit "to date" marker for the in-progress season. */
function seasonLabel(season: string, inProgress: boolean): string {
  return inProgress ? `${season} · to date` : season
}

/** Avatar with a React-state fallback (no innerHTML) when the Sleeper CDN image 404s. */
function PlayerAvatar({ playerId, name, large = false }: { playerId: string; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  const dim = large ? 'w-20 h-20 text-2xl' : 'w-12 h-12 text-lg'

  if (failed) {
    return (
      <div className={`${dim} rounded-full bg-slate-800 shrink-0 flex items-center justify-center text-slate-500`}>
        🏈
      </div>
    )
  }

  return (
    <div className={`${dim} rounded-full overflow-hidden bg-slate-800 shrink-0`}>
      <img
        src={playerImageUrl(playerId)}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

/** Height / weight / college / rookie-year facts, shown wherever they're available. */
function BioFacts({ height, weight, college, rookieYear }: {
  height: string | null
  weight: string | null
  college: string | null
  rookieYear: string | null
}) {
  const facts = [
    height,
    weight ? `${weight} lbs` : null,
    college,
    rookieYear ? `Rookie class ${rookieYear}` : null,
  ].filter(Boolean)

  if (facts.length === 0) return null

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1.5">
      {facts.map((f) => <span key={f}>{f}</span>)}
    </div>
  )
}

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: players, isLoading: playersLoading, error: playersError } = usePlayers()
  const { rows, isLoading: scoresLoading, error: scoresError, scoringFormat } = useValueScores()
  const { toggle, has } = useWatchlistStore()

  // All hooks run unconditionally, above any early return — a `useMemo` after
  // an early `return` changes the hook count once data arrives, which is what
  // crashed direct loads of /player/:id (see improvement plan §1).
  const player: SleeperPlayer | null = id && players ? (players[id] ?? null) : null
  const row = useMemo(() => rows.find((r) => r.playerId === id), [rows, id])
  const pos = row?.position ?? (player ? primaryPosition(player) : null)

  const statColumns = useMemo(() => (pos ? statColumnsForPosition(pos) : []), [pos])

  const ppgChartData = useMemo(() => {
    if (!row) return []
    return [...row.ppgHistory].reverse().map((h) => ({
      season: h.season,
      seasonDisplay: seasonLabel(h.season, h.inProgress),
      ppg: parseFloat(h.ppg.toFixed(1)),
      gp: h.gp,
      inProgress: h.inProgress,
    }))
  }, [row])

  const isLoading = playersLoading || scoresLoading
  const error = playersError ?? scoresError

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="h-32 bg-slate-800/40 rounded-xl animate-pulse" />
        <div className="h-48 bg-slate-800/40 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 text-sm font-medium">Couldn't load this player.</p>
        <p className="text-slate-500 text-xs mt-1">{error.message}</p>
        <button onClick={() => navigate('/players')} className="mt-4 text-violet-400 text-sm hover:underline">
          ← Back to players
        </button>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-400">Player not found.</p>
        <button onClick={() => navigate('/players')} className="mt-4 text-violet-400 text-sm hover:underline">
          ← Back to players
        </button>
      </div>
    )
  }

  const fullName = playerName(player)
  const watched = has(player.player_id)

  // Exists in Sleeper's player pool but not eligible/scored (e.g. retired, no team,
  // no recent games) — show what we know instead of a misleading "not found".
  if (!row) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
          ← Back
        </button>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <div className="flex items-start gap-5">
            <PlayerAvatar playerId={player.player_id} name={fullName} large />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white">{fullName}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {pos && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${positionBadgeClass(pos)}`}>
                    {pos}
                  </span>
                )}
                <TeamGradeChip team={player.team} showGrade={false} />
              </div>
              <BioFacts
                height={formatHeight(player.height)}
                weight={player.weight}
                college={player.college}
                rookieYear={player.metadata?.rookie_year ?? null}
              />
              <p className="text-xs text-amber-400/80 mt-3">
                Not currently scored — no team and no recent games.
              </p>
            </div>
            <button
              onClick={() => toggle(player.player_id)}
              className={`text-sm transition-colors shrink-0 ${watched ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}`}
              title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {watched ? '★ Watching' : '☆ Watch'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
      >
        ← Back
      </button>

      {/* Hero card */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-5">
          <PlayerAvatar playerId={player.player_id} name={fullName} large />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{fullName}</h1>
              {row.scores.isProvisional && (
                <span className="text-xs bg-amber-950/60 border border-amber-700/40 text-amber-300 px-2 py-0.5 rounded-full mt-1">
                  Rookie
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${positionBadgeClass(row.position)}`}>
                {row.position}
              </span>
              <TeamGradeChip team={row.team} grade={row.scores.teamGrade} showGrade />
              {player.age && (
                <span className="text-xs text-slate-500">Age {player.age}</span>
              )}
              <span className="text-xs text-slate-500">
                {row.yearsExp === 0 ? 'Rookie' : `${row.yearsExp}yr exp`}
              </span>
              {player.injury_status && (
                <span className={`text-xs font-medium ${
                  player.injury_status === 'Out' || player.injury_status === 'IR'
                    ? 'text-red-400'
                    : 'text-yellow-400'
                }`}>
                  {player.injury_status}
                </span>
              )}
            </div>

            <BioFacts height={row.height} weight={row.weight} college={row.college} rookieYear={row.rookieYear} />
          </div>

          {/* Value score + watchlist */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <ValueScoreBadge score={row.scores.valueScore} scores={row.scores} title={row.fullName} size="lg" showLabel />
            <button
              onClick={() => toggle(player.player_id)}
              className={`text-sm transition-colors ${watched ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}`}
              title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
            >
              {watched ? '★ Watching' : '☆ Watch'}
            </button>
          </div>
        </div>
      </div>

      {/* PPG trend chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">
          Fantasy PPG History ({SCORING_FORMAT_LABELS[scoringFormat]})
        </h2>
        {ppgChartData.length < 2 ? (
          <p className="text-slate-500 text-sm">Not enough season data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={ppgChartData}>
              <CartesianGrid stroke="#1e2130" />
              <XAxis
                dataKey="season"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(season: string) => {
                  const point = ppgChartData.find((d) => d.season === season)
                  return point?.inProgress ? `${season}*` : season
                }}
              />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e2130', border: '1px solid #2e3347', borderRadius: 6, fontSize: 11 }}
                labelFormatter={(label) => {
                  const season = String(label)
                  const point = ppgChartData.find((d) => d.season === season)
                  return point?.seasonDisplay ?? season
                }}
                formatter={(v, _name, item) => {
                  const gp = item?.payload?.gp
                  const ppgLabel = typeof v === 'number' ? v.toFixed(1) : '—'
                  return [gp ? `${ppgLabel} PPG · ${gp} GP` : `${ppgLabel} PPG`, '']
                }}
              />
              <Line
                type="monotone"
                dataKey="ppg"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {ppgChartData.some((d) => d.inProgress) && (
          <p className="text-[11px] text-slate-600 mt-2">* season in progress — to date</p>
        )}
      </div>

      {/* Value score breakdown */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Value Score Breakdown</h2>
        <ScoreBreakdown scores={row.scores} />
      </div>

      {/* Season stats table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Season Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800">
                {['Season', 'GP', 'PPG', ...statColumns.map((c) => c.label)].map((h) => (
                  <th key={h} className="py-2 pr-4 text-slate-500 font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {row.ppgHistory.map((h) => (
                <tr key={h.season} className="border-b border-slate-800/50">
                  <td className="py-2 pr-4 text-slate-300 font-medium whitespace-nowrap">
                    {seasonLabel(h.season, h.inProgress)}
                  </td>
                  <td className="py-2 pr-4 text-slate-400 tabular-nums">{h.gp || '—'}</td>
                  <td className="py-2 pr-4 text-slate-300 tabular-nums font-medium">{h.ppg.toFixed(1)}</td>
                  {statColumns.map((col) => (
                    <td key={col.label} className="py-2 pr-4 text-slate-400 tabular-nums">
                      {h.gp > 0 ? col.value(h.raw, h.gp) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
