import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useValueScores } from '@/hooks/useValueScores'
import { useTrendingPlayers } from '@/hooks/useTrendingPlayers'
import { positionBadgeClass } from '@/lib/positions'
import { ValueScoreBadge } from './ValueScoreBadge'
import type { PlayerRow } from '@/types/scoring'

interface TrendingEntry {
  row: PlayerRow
  addCount: number
}

const LOOKBACKS = [
  { label: '2h', hours: 2 },
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
]

function useTrendingEntries(lookbackHours: number, limit: number): {
  entries: TrendingEntry[]
  isLoading: boolean
  error: Error | null
} {
  const { rows } = useValueScores()
  const trending = useTrendingPlayers('add', lookbackHours, Math.max(limit * 2, 25))

  const entries = useMemo(() => {
    if (!trending.data) return []
    const byId = new Map(rows.map((r) => [r.playerId, r]))
    const out: TrendingEntry[] = []
    for (const t of trending.data) {
      const row = byId.get(t.player_id)
      if (!row) continue   // unscored position, or filtered out upstream (e.g. retired)
      out.push({ row, addCount: t.count })
      if (out.length >= limit) break
    }
    return out
  }, [trending.data, rows, limit])

  return { entries, isLoading: trending.isLoading, error: trending.error }
}

/** Compact horizontal strip of the most-added players — for the dashboard home screen. */
export function TrendingAddsStrip({ limit = 8 }: { limit?: number }) {
  const { entries, isLoading, error } = useTrendingEntries(24, limit)
  const navigate = useNavigate()

  if (error) return null
  if (!isLoading && entries.length === 0) return null

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-semibold text-slate-200">🔥 Trending Adds</h2>
        <span className="text-xs text-slate-500">last 24h across Sleeper leagues</span>
        <div className="flex-1" />
        <Link to="/trending" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
          See all →
        </Link>
      </div>

      {isLoading ? (
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 w-40 shrink-0 bg-slate-800/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {entries.map(({ row, addCount }) => (
            <button
              key={row.playerId}
              onClick={() => navigate(`/player/${row.playerId}`)}
              className="flex items-center gap-2.5 shrink-0 w-44 px-3 py-2 rounded-lg border border-slate-800
                bg-slate-900/40 hover:border-violet-500/50 hover:bg-slate-800/40 transition-colors text-left"
            >
              <ValueScoreBadge score={row.scores.valueScore} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold px-1 py-0.5 rounded shrink-0 ${positionBadgeClass(row.position)}`}>
                    {row.position}
                  </span>
                  <span className="text-sm text-slate-200 truncate">{row.fullName}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {row.team ?? 'FA'} · <span className="text-emerald-400">▲{addCount.toLocaleString()} adds</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Full trending-adds list, with a lookback-window toggle — for the dedicated Trending tab. */
export function TrendingAddsTable() {
  const [lookbackHours, setLookbackHours] = useState(24)
  const { entries, isLoading, error } = useTrendingEntries(lookbackHours, 50)
  const navigate = useNavigate()

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-lg font-bold text-white mr-2">Trending Adds</h1>
        <div className="flex items-center rounded-lg border border-slate-700 overflow-hidden text-xs">
          {LOOKBACKS.map((lb) => (
            <button
              key={lb.hours}
              onClick={() => setLookbackHours(lb.hours)}
              data-active={lookbackHours === lb.hours}
              className="px-2.5 py-1 font-medium text-slate-400 whitespace-nowrap border-l border-slate-700 first:border-l-0
                data-[active=true]:bg-violet-600/20 data-[active=true]:text-violet-300
                hover:text-slate-200 transition-colors"
            >
              {lb.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">Most-added players across Sleeper leagues right now.</span>
      </div>

      {error ? (
        <div className="flex items-center justify-center h-64 text-red-400 text-sm">
          Failed to load trending data. Sleeper API may be unavailable.
        </div>
      ) : isLoading ? (
        <div className="space-y-2 mt-3">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-800/40 rounded animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 mt-6 text-center">No trending data available right now.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800 mt-3">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">#</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Player</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Team</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Adds</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(({ row, addCount }, i) => (
                <tr
                  key={row.playerId}
                  onClick={() => navigate(`/player/${row.playerId}`)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 text-slate-500 text-xs tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-1 py-0.5 rounded shrink-0 ${positionBadgeClass(row.position)}`}>
                        {row.position}
                      </span>
                      <span className="text-sm text-slate-200 truncate">{row.fullName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-400">{row.team ?? 'FA'}</td>
                  <td className="px-3 py-2 text-right text-sm text-emerald-400 tabular-nums">▲{addCount.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <ValueScoreBadge score={row.scores.valueScore} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
