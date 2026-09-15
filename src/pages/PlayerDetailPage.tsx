import { useParams, useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { usePlayers } from '@/hooks/usePlayers'
import { useValueScores } from '@/hooks/useValueScores'
import { playerImageUrl } from '@/lib/sleeper'
import { ValueScoreBadge } from '@/components/ValueScoreBadge'
import { TeamGradeChip } from '@/components/TeamGradeChip'
import { positionBadgeClass } from '@/lib/positions'
import { useWatchlistStore } from '@/store/watchlist'
import type { SleeperPlayerStats } from '@/types/sleeper'
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

export function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: players, isLoading: playersLoading } = usePlayers()
  const { rows, isLoading: scoresLoading } = useValueScores()
  const { toggle, has } = useWatchlistStore()

  const player = id && players ? players[id] : null
  const row = useMemo(() => rows.find((r) => r.playerId === id), [rows, id])

  const isLoading = playersLoading || scoresLoading

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="h-32 bg-slate-800/40 rounded-xl animate-pulse" />
        <div className="h-48 bg-slate-800/40 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (!player || !row) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-400">Player not found.</p>
        <button onClick={() => navigate('/players')} className="mt-4 text-violet-400 text-sm hover:underline">
          ← Back to players
        </button>
      </div>
    )
  }

  const fullName = player.full_name ?? `${player.first_name} ${player.last_name}`
  const pos = row.position
  const watched = has(player.player_id)

  const ppgChartData = [...row.ppgHistory].reverse().map((h) => ({
    season: h.season,
    ppg: parseFloat(h.ppg.toFixed(1)),
    gp: h.gp,
  }))

  const statColumns = useMemo(() => statColumnsForPosition(pos), [pos])

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
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-800 shrink-0">
            <img
              src={playerImageUrl(player.player_id)}
              alt={fullName}
              className="w-full h-full object-cover"
              onError={(e) => {
                const el = e.target as HTMLImageElement
                el.style.display = 'none'
                el.parentElement!.innerHTML = `<span class="flex items-center justify-center w-full h-full text-2xl text-slate-500">🏈</span>`
              }}
            />
          </div>

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
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${positionBadgeClass(pos)}`}>
                {pos}
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

            {player.college && (
              <p className="text-xs text-slate-500 mt-1">{player.college}</p>
            )}
          </div>

          {/* Value score + watchlist */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <ValueScoreBadge score={row.scores.valueScore} size="lg" showLabel />
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
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Fantasy PPG History (Half PPR)</h2>
        {ppgChartData.length < 2 ? (
          <p className="text-slate-500 text-sm">Not enough season data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={ppgChartData}>
              <CartesianGrid stroke="#1e2130" />
              <XAxis dataKey="season" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e2130', border: '1px solid #2e3347', borderRadius: 6, fontSize: 11 }}
                formatter={(v) => [typeof v === 'number' ? v.toFixed(1) : '—', 'PPG']}
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
                  <td className="py-2 pr-4 text-slate-300 font-medium">{h.season}</td>
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
