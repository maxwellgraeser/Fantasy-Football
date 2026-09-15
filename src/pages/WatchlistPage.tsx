import { useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useValueScores } from '@/hooks/useValueScores'
import { useWatchlistStore } from '@/store/watchlist'
import { ValueScoreBadge } from '@/components/ValueScoreBadge'
import { TeamGradeChip } from '@/components/TeamGradeChip'
import { TrendSparkline } from '@/components/TrendSparkline'
import { positionBadgeClass } from '@/components/PositionFilter'

export function WatchlistPage() {
  const { rows, isLoading } = useValueScores()
  const { playerIds, toggle } = useWatchlistStore()
  const navigate = useNavigate()

  const watched = useMemo(
    () => rows.filter((r) => playerIds.includes(r.playerId)),
    [rows, playerIds],
  )

  const handleRowClick = useCallback(
    (id: string) => navigate(`/player/${id}`),
    [navigate],
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-lg font-bold text-white">Watchlist</h1>
        <span className="text-xs text-slate-500 tabular-nums">{playerIds.length} players</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-800/40 rounded animate-pulse" />
          ))}
        </div>
      ) : playerIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
          <span className="text-3xl">☆</span>
          <p className="text-slate-400 text-sm">No players on your watchlist yet.</p>
          <p className="text-slate-600 text-xs">Click the ☆ next to any player in the Players tab to add them.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60">
                {['#', 'Value', 'Player', 'Pos', 'Team', 'Age', 'Exp', 'Player', 'Opp', 'Team Gr.', 'PPG', 'Trend', ''].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {watched.map((r, i) => (
                <tr
                  key={r.playerId}
                  onClick={() => handleRowClick(r.playerId)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2 text-slate-500 text-xs tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2">
                    <ValueScoreBadge score={r.scores.valueScore} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggle(r.playerId) }}
                        className="shrink-0 text-xs text-yellow-400 transition-colors"
                        title="Remove from watchlist"
                      >
                        ★
                      </button>
                      <span className="text-slate-200 text-sm font-medium truncate">{r.fullName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${positionBadgeClass(r.position)}`}>
                      {r.position}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <TeamGradeChip team={r.team} grade={r.scores.teamGrade} showGrade />
                  </td>
                  <td className="px-3 py-2 text-slate-400 text-xs tabular-nums">{r.age ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-400 text-xs tabular-nums">{r.yearsExp}yr</td>
                  <td className="px-3 py-2 text-slate-300 text-xs tabular-nums font-medium">{r.scores.playerGrade}</td>
                  <td className="px-3 py-2 text-slate-300 text-xs tabular-nums font-medium">{r.scores.opportunityGrade}</td>
                  <td className="px-3 py-2 text-slate-300 text-xs tabular-nums font-medium">{r.scores.teamGrade}</td>
                  <td className="px-3 py-2 text-slate-300 text-xs tabular-nums">{(r.ppgHistory[0]?.ppg ?? 0).toFixed(1)}</td>
                  <td className="px-3 py-2">
                    <TrendSparkline data={r.sparkline} />
                  </td>
                  <td className="px-3 py-2">
                    {r.injuryStatus && (
                      <span className={`text-xs ${r.injuryStatus === 'Out' || r.injuryStatus === 'IR' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {r.injuryStatus === 'Questionable' ? 'Q' : r.injuryStatus}
                      </span>
                    )}
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
