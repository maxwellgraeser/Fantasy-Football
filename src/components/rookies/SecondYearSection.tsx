import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { ppgDescription } from '@/lib/scoring/explain'
import { ValueScoreBadge } from '@/components/ValueScoreBadge'
import { TeamGradeChip } from '@/components/TeamGradeChip'
import { HeaderTooltip } from '@/components/Tooltip'
import { positionBadgeClass } from '@/lib/positions'
import { STICKY_TD, STICKY_TH } from './tableStyles'
import type { PlayerRow, ScoringFormat } from '@/types/scoring'
import type { SeasonContext } from '@/hooks/useSeasonContext'

const SHOW_COUNT = 25

interface SecondYearRow extends PlayerRow {
  rookiePpg: number | null
  rookieGp: number
}

interface Props {
  rows: PlayerRow[]
  season: SeasonContext
  scoringFormat: ScoringFormat
}

/** Section 2: last year's rookie class, framed as breakout candidates off their rookie-season stats. */
export function SecondYearSection({ rows, season, scoringFormat }: Props) {
  const navigate = useNavigate()
  const rookieSeason = String(Number(season.latestSeason) - 1)

  const [sorting, setSorting] = useState<SortingState>([{ id: 'rookiePpg', desc: true }])
  const [showAll, setShowAll] = useState(false)

  const classRows = useMemo<SecondYearRow[]>(() => {
    return rows
      .filter((r) => r.rookieYear === rookieSeason)
      .map((r) => {
        // ppgHistory always includes any season with recorded games, regardless of the
        // Players-page season toggle — so the rookie-season line is always available here.
        const line = r.ppgHistory.find((h) => h.season === rookieSeason)
        return { ...r, rookiePpg: line?.ppg ?? null, rookieGp: line?.gp ?? 0 }
      })
  }, [rows, rookieSeason])

  const columns = useMemo<ColumnDef<SecondYearRow>[]>(() => [
    {
      id: 'name',
      header: 'Player',
      accessorFn: (r) => r.fullName,
      cell: ({ row }) => <span className="text-slate-200 text-sm font-medium truncate">{row.original.fullName}</span>,
      size: 170,
    },
    {
      id: 'position',
      header: 'Pos',
      accessorFn: (r) => r.position,
      cell: ({ getValue }) => {
        const pos = getValue<string>()
        return <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${positionBadgeClass(pos)}`}>{pos}</span>
      },
      size: 56,
    },
    {
      id: 'team',
      header: 'Team',
      accessorFn: (r) => r.team ?? '',
      cell: ({ row }) => <TeamGradeChip team={row.original.team} grade={row.original.scores.teamGrade} showGrade />,
      size: 90,
    },
    {
      id: 'age',
      header: 'Age',
      accessorFn: (r) => r.age ?? undefined,
      sortUndefined: 'last',
      cell: ({ getValue }) => <span className="text-slate-400 text-xs tabular-nums">{getValue<number | undefined>() ?? '—'}</span>,
      size: 48,
    },
    {
      id: 'rookieGp',
      header: () => <HeaderTooltip label="Rookie GP" tip={`Games played in their ${rookieSeason} rookie season.`} />,
      accessorFn: (r) => r.rookieGp,
      cell: ({ getValue }) => <span className="text-slate-400 text-xs tabular-nums">{getValue<number>()}</span>,
      size: 76,
    },
    {
      id: 'rookiePpg',
      header: () => <HeaderTooltip label="Rookie PPG" tip={ppgDescription(rookieSeason, scoringFormat, false)} />,
      accessorFn: (r) => r.rookiePpg ?? undefined,
      sortUndefined: 'last',
      cell: ({ getValue }) => {
        const v = getValue<number | undefined>()
        return <span className="text-slate-300 text-xs tabular-nums">{v != null ? v.toFixed(1) : '—'}</span>
      },
      size: 84,
    },
    {
      id: 'value',
      header: () => (
        <HeaderTooltip label="Value" tip={`Current 0–100 Value score, graded on the ${season.selectedSeason} season.`} />
      ),
      accessorFn: (r) => r.scores.valueScore,
      cell: ({ row }) => <ValueScoreBadge score={row.original.scores.valueScore} scores={row.original.scores} title={row.original.fullName} size="sm" />,
      size: 72,
    },
  ], [rookieSeason, scoringFormat, season.selectedSeason])

  const table = useReactTable({
    data: classRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const sortedRows = table.getRowModel().rows
  const displayedRows = showAll ? sortedRows : sortedRows.slice(0, SHOW_COUNT)

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <h2 className="text-lg font-bold text-white">{rookieSeason} Second-Year Players</h2>
        <span className="text-xs text-slate-500 tabular-nums">{classRows.length} players</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Breakout candidates — how the {rookieSeason} rookie class performed in its first season, next to its current Value.
      </p>

      {classRows.length === 0 ? (
        <p className="text-slate-500 text-sm">No {rookieSeason} rookie-class players found.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left border-collapse">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-800 bg-slate-900/60">
                    <th className={`px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider ${STICKY_TH}`}>#</th>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        style={{ width: header.getSize() }}
                        className={`px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none
                          ${header.column.id === 'name' ? STICKY_TH : ''}`}
                      >
                        <div
                          className={header.column.getCanSort() ? 'cursor-pointer hover:text-slate-300 flex items-center gap-1' : ''}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && ' ↑'}
                          {header.column.getIsSorted() === 'desc' && ' ↓'}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {displayedRows.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/player/${row.original.playerId}`)}
                    className="group border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                  >
                    <td className={`px-3 py-2 text-slate-500 text-xs tabular-nums ${STICKY_TD}`}>{i + 1}</td>
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={`px-3 py-2 ${cell.column.id === 'name' ? STICKY_TD : ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sortedRows.length > SHOW_COUNT && (
            <div className="flex justify-center mt-3">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="px-3 py-1.5 text-xs text-slate-300 border border-slate-700 rounded-lg
                  hover:border-violet-500 hover:text-violet-300 transition-colors"
              >
                {showAll ? 'Show top 25' : `Show all ${sortedRows.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
