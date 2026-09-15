import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { FantasyPosition } from '@/types/sleeper'
import type { PlayerRow, ScoringFormat, ScoringWeights } from '@/types/scoring'
import { HeaderTooltip } from './Tooltip'
import { ValueScoreBadge } from './ValueScoreBadge'
import { TeamGradeChip } from './TeamGradeChip'
import { TrendSparkline } from './TrendSparkline'
import { positionBadgeClass } from '@/lib/positions'
import { GRADE_EXPLANATIONS, ppgDescription, valueFormulaText } from '@/lib/scoring/explain'
import { normalizeGradeWeights } from '@/lib/scoring/value'

/** Positions shown when the position filter's "All" chip is active — DEF is opt-in. */
export const DEFAULT_FILTER_POSITIONS: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE']

interface PlayerColumnsOptions {
  has: (id: string) => boolean
  toggle: (id: string) => void
  weights: ScoringWeights
  selectedSeason: string
  scoringFormat: ScoringFormat
  isInProgress: boolean
}

function gradeCell(value: number | null | undefined) {
  if (value == null) return <span className="text-slate-600 text-xs">n/a</span>
  return <span className="text-slate-300 text-xs tabular-nums font-medium">{value}</span>
}

/**
 * Column definitions shared by the Players and Watchlist tables — same grades,
 * tooltips, sparkline and Value popover everywhere a PlayerRow is listed.
 * The "rank" column's cell is intentionally a no-op: callers render the row's
 * position in the displayed (sorted/filtered) list themselves, since row.index
 * reflects the *source* order, not the current sort.
 */
export function usePlayerColumns({
  has,
  toggle,
  weights,
  selectedSeason,
  scoringFormat,
  isInProgress,
}: PlayerColumnsOptions): ColumnDef<PlayerRow>[] {
  return useMemo<ColumnDef<PlayerRow>[]>(() => {
    const valueTip = `0–100 composite. ${valueFormulaText(normalizeGradeWeights(weights))} (rookies × 0.85). Click ⚙ Weights to adjust.`
    const ppgTip = ppgDescription(selectedSeason, scoringFormat, isInProgress)

    return [
      {
        id: 'rank',
        header: '#',
        cell: () => null,
        enableSorting: false,
        size: 36,
      },
      {
        id: 'valueScore',
        header: () => <HeaderTooltip label="Value" tip={valueTip} width={240} />,
        accessorFn: (r) => r.scores.valueScore,
        cell: ({ row }) => (
          <ValueScoreBadge
            score={row.original.scores.valueScore}
            scores={row.original.scores}
            title={row.original.fullName}
          />
        ),
        size: 72,
      },
      {
        id: 'name',
        header: 'Player',
        accessorFn: (r) => r.fullName,
        cell: ({ row }) => {
          const p = row.original
          const watched = has(p.playerId)
          return (
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={(e) => { e.stopPropagation(); toggle(p.playerId) }}
                className={`shrink-0 text-xs transition-colors ${watched ? 'text-yellow-400' : 'text-slate-700 hover:text-slate-500'}`}
                title={watched ? 'Remove from watchlist' : 'Add to watchlist'}
              >
                {watched ? '★' : '☆'}
              </button>
              <span className="text-slate-200 text-sm font-medium truncate">{p.fullName}</span>
            </div>
          )
        },
        size: 180,
      },
      {
        id: 'position',
        header: () => <HeaderTooltip label="Pos" tip="Fantasy position." />,
        accessorFn: (r) => r.position,
        cell: ({ getValue }) => {
          const pos = getValue<string>()
          return (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${positionBadgeClass(pos)}`}>
              {pos}
            </span>
          )
        },
        size: 56,
      },
      {
        id: 'team',
        header: () => <HeaderTooltip label="Team" tip="NFL team. The number is the Team Grade (offensive context) when it applies." />,
        accessorFn: (r) => r.team ?? '',
        cell: ({ row }) => (
          <TeamGradeChip
            team={row.original.team}
            grade={row.original.scores.teamGrade}
            showGrade
          />
        ),
        size: 90,
      },
      {
        id: 'age',
        header: () => <HeaderTooltip label="Age" tip="Player's current age." />,
        accessorFn: (r) => r.age ?? undefined,
        sortUndefined: 'last',
        cell: ({ getValue }) => (
          <span className="text-slate-400 text-xs tabular-nums">{getValue<number | undefined>() ?? '—'}</span>
        ),
        size: 52,
      },
      {
        id: 'exp',
        header: () => <HeaderTooltip label="Exp" tip="NFL seasons completed." />,
        accessorFn: (r) => r.yearsExp,
        cell: ({ getValue }) => (
          <span className="text-slate-400 text-xs tabular-nums">{getValue<number>()}yr</span>
        ),
        size: 52,
      },
      {
        id: 'grades',
        header: 'Grades',
        columns: [
          {
            id: 'playerGrade',
            header: () => <HeaderTooltip label="Player" tip={GRADE_EXPLANATIONS.player.short} width={240} />,
            accessorFn: (r) => r.scores.playerGrade,
            cell: ({ getValue }) => gradeCell(getValue<number>()),
            size: 60,
          },
          {
            id: 'oppGrade',
            header: () => <HeaderTooltip label="Opp" tip={GRADE_EXPLANATIONS.opportunity.short} width={240} />,
            accessorFn: (r) => r.scores.opportunityGrade ?? undefined,
            sortUndefined: 'last',
            cell: ({ getValue }) => gradeCell(getValue<number | undefined>()),
            size: 60,
          },
          {
            id: 'teamGrade',
            header: () => <HeaderTooltip label="Team" tip={GRADE_EXPLANATIONS.team.short} width={240} />,
            accessorFn: (r) => r.scores.teamGrade ?? undefined,
            sortUndefined: 'last',
            cell: ({ getValue }) => gradeCell(getValue<number | undefined>()),
            size: 60,
          },
        ],
      },
      {
        id: 'ppg',
        header: () => <HeaderTooltip label="PPG" tip={ppgTip} />,
        accessorFn: (r) => r.seasonPpg ?? undefined,
        sortUndefined: 'last',
        cell: ({ getValue }) => {
          const v = getValue<number | undefined>()
          return <span className="text-slate-300 text-xs tabular-nums">{v == null ? '—' : v.toFixed(1)}</span>
        },
        size: 60,
      },
      {
        id: 'trend',
        header: () => (
          <HeaderTooltip
            label="Trend"
            width={260}
            tip="Fantasy points per game by season, oldest → newest (last 5 seasons played). Green = latest season is higher than the previous one; red = lower. Hollow dot = season in progress."
          />
        ),
        accessorFn: (r) => r.sparkline,
        cell: ({ row }) => <TrendSparkline data={row.original.sparkline} />,
        enableSorting: false,
        size: 100,
      },
      {
        id: 'injury',
        header: '',
        accessorFn: (r) => r.injuryStatus,
        cell: ({ getValue }) => {
          const s = getValue<string | null>()
          if (!s) return null
          const color = s === 'Out' || s === 'IR' ? 'text-red-400' : 'text-yellow-400'
          return <span className={`text-xs ${color}`}>{s === 'Questionable' ? 'Q' : s}</span>
        },
        enableSorting: false,
        size: 32,
      },
    ]
  }, [has, toggle, weights, selectedSeason, scoringFormat, isInProgress])
}
