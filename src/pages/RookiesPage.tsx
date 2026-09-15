import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlayers } from '@/hooks/usePlayers'
import { useValueScores } from '@/hooks/useValueScores'
import { ValueScoreBadge } from '@/components/ValueScoreBadge'
import { TeamGradeChip } from '@/components/TeamGradeChip'
import { positionBadgeClass } from '@/components/PositionFilter'
import prospectsData from '@/data/prospects-2026.json'
import type { FantasyPosition } from '@/types/sleeper'

const SKILL_POSITIONS: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE']
const FANTASY_POSITIONS = new Set(SKILL_POSITIONS as string[])

// Prospects with a fantasy-relevant position
const FANTASY_PROSPECTS = prospectsData.filter((p) => FANTASY_POSITIONS.has(p.position))

export function RookiesPage() {
  const navigate = useNavigate()
  const { isLoading: playersLoading } = usePlayers()
  const { rows, isLoading: scoresLoading } = useValueScores()
  const [showAllProspects, setShowAllProspects] = useState(false)

  const isLoading = playersLoading || scoresLoading

  // First-year players = years_exp === 1 (2025 NFL draft class, just finished their first season).
  // years_exp === 0 in Sleeper includes retired legends (e.g. Kurt Warner) with stale data — not rookies.
  const currentRookies = useMemo(() => {
    return rows.filter((r) => r.yearsExp === 1 && r.position !== 'DEF')
  }, [rows])

  // 2026 prospects list
  const prospects = showAllProspects ? prospectsData : FANTASY_PROSPECTS

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
      {/* ── Section 1: Current-year rookies ─────────────────────────────── */}
      <section>
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="text-lg font-bold text-white">Current-Year Rookies</h2>
          <span className="text-xs text-slate-500">(years_exp = 0 · provisional scores)</span>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-800/40 rounded animate-pulse" />
            ))}
          </div>
        ) : currentRookies.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No rookie data loaded yet — may not be available until the season starts.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  {['#', 'Value*', 'Player', 'Pos', 'Team', 'Age', 'DC', 'PPG', 'Player', 'Opp', 'Team Gr.'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentRookies.map((r, i) => (
                  <tr
                    key={r.playerId}
                    onClick={() => navigate(`/player/${r.playerId}`)}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2 text-slate-500 text-xs tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">
                      <ValueScoreBadge score={r.scores.valueScore} size="sm" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-200 text-sm font-medium">{r.fullName}</span>
                        <span className="text-xs bg-amber-950/60 border border-amber-700/40 text-amber-400 px-1 py-0.5 rounded">R</span>
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
                    <td className="px-3 py-2 text-xs text-slate-400 tabular-nums">{r.age ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-400 tabular-nums">
                      {r.depthChartOrder ? `DC${r.depthChartOrder}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300 tabular-nums">
                      {(r.ppgHistory[0]?.ppg ?? 0).toFixed(1)}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-300 tabular-nums">{r.scores.playerGrade}</td>
                    <td className="px-3 py-2 text-xs text-slate-300 tabular-nums">{r.scores.opportunityGrade}</td>
                    <td className="px-3 py-2 text-xs text-slate-300 tabular-nums">{r.scores.teamGrade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-600 mt-2">* Provisional — reduced player-grade confidence due to limited NFL data.</p>
      </section>

      {/* ── Section 2: 2026 Incoming class ──────────────────────────────── */}
      <section>
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-lg font-bold text-white">2026 Incoming Draft Class</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Consensus board curated from public draft sources. No ValueScore yet — draft data only.
          {!showAllProspects && ' Showing fantasy-relevant positions (QB/RB/WR/TE).'}
        </p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setShowAllProspects(false)}
            data-active={!showAllProspects}
            className="px-3 py-1.5 text-xs rounded border border-slate-700 text-slate-400
              data-[active=true]:border-violet-500 data-[active=true]:text-violet-300 data-[active=true]:bg-violet-950/30
              hover:border-slate-500 transition-colors"
          >
            Fantasy positions
          </button>
          <button
            onClick={() => setShowAllProspects(true)}
            data-active={showAllProspects}
            className="px-3 py-1.5 text-xs rounded border border-slate-700 text-slate-400
              data-[active=true]:border-violet-500 data-[active=true]:text-violet-300 data-[active=true]:bg-violet-950/30
              hover:border-slate-500 transition-colors"
          >
            Full board
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {prospects.map((p) => {
            const isFantasyRelevant = FANTASY_POSITIONS.has(p.position)
            return (
              <div
                key={p.id}
                className={`
                  bg-slate-900/50 border rounded-xl p-4 space-y-2
                  ${isFantasyRelevant ? 'border-slate-700/60' : 'border-slate-800/40 opacity-60'}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">{p.name}</span>
                      {p.projectedRound === 1 && (
                        <span className="text-xs bg-violet-950/60 border border-violet-700/40 text-violet-300 px-1.5 py-0.5 rounded">
                          1st Rd
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.college}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${positionBadgeClass(p.position)}`}>
                      {p.position}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">#{p.consensusRank}</span>
                  </div>
                </div>

                {p.notes && (
                  <p className="text-xs text-slate-500 leading-relaxed">{p.notes}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-slate-600">
                  {p.height && <span>{p.height}</span>}
                  {p.weight && <span>{p.weight} lbs</span>}
                  {p.age && <span>Age {p.age}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
