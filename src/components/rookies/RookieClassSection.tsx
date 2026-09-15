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
import { useSeasonStats } from '@/hooks/useSeasonStats'
import { computePpg } from '@/lib/scoring/playerGrade'
import { ppgDescription, ROOKIE_NOTE } from '@/lib/scoring/explain'
import { ValueScoreBadge } from '@/components/ValueScoreBadge'
import { TeamGradeChip } from '@/components/TeamGradeChip'
import { HeaderTooltip } from '@/components/Tooltip'
import { positionBadgeClass } from '@/lib/positions'
import { STICKY_TD, STICKY_TH } from './tableStyles'
import type { PlayerRow, ScoringFormat } from '@/types/scoring'
import type { SeasonContext } from '@/hooks/useSeasonContext'
import type { FantasyPosition } from '@/types/sleeper'

const ROOKIE_POSITIONS: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE']

interface RookieRow extends PlayerRow {
  /** PPG for the rookie class's own season, independent of the Players-page season toggle. */
  ytdPpg: number | null
}

interface Props {
  rows: PlayerRow[]
  season: SeasonContext
  scoringFormat: ScoringFormat
}

/** Section 1: this year's rookie class, sourced straight from Sleeper eligibility. */
export function RookieClassSection({ rows, season, scoringFormat }: Props) {
  const navigate = useNavigate()
  const rookieSeason = season.latestSeason

  const [position, setPosition] = useState<FantasyPosition | null>(null)
  const [startersOnly, setStartersOnly] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'searchRank', desc: false }])

  // Rows are scored against `season.selectedSeason` (the Players-page toggle). When that
  // differs from the rookie class's own season, seasonPpg won't cover this class's games,
  // so fetch the rookie season's stats directly just for the YTD PPG column.
  const needsLiveStats = season.selectedSeason !== rookieSeason && season.inProgressSeason === rookieSeason
  const liveStats = useSeasonStats(needsLiveStats ? rookieSeason : null)

  const classRows = useMemo<RookieRow[]>(() => {
    return rows
      .filter((r) => r.rookieYear === rookieSeason && r.team !== null && r.position !== 'DEF')
      .map((r) => {
        let ytdPpg: number | null
        if (season.selectedSeason === rookieSeason) {
          ytdPpg = r.seasonPpg
        } else if (needsLiveStats) {
          const stats = liveStats.data?.[r.playerId]
          ytdPpg = stats?.gp ? computePpg(stats, scoringFormat) : null
        } else {
          ytdPpg = null
        }
        return { ...r, ytdPpg }
      })
  }, [rows, rookieSeason, season.selectedSeason, needsLiveStats, liveStats.data, scoringFormat])

  const filteredRows = useMemo(() => {
    let r = classRows
    if (position) r = r.filter((p) => p.position === position)
    if (startersOnly) r = r.filter((p) => p.depthChartOrder === 1)
    return r
  }, [classRows, position, startersOnly])

  const ytdTip = needsLiveStats
    ? ppgDescription(rookieSeason, scoringFormat, true)
    : ppgDescription(season.selectedSeason, scoringFormat, season.isInProgress)

  const columns = useMemo<ColumnDef<RookieRow>[]>(() => [
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
      id: 'college',
      header: 'College',
      accessorFn: (r) => r.college ?? undefined,
      sortUndefined: 'last',
      cell: ({ getValue }) => <span className="text-slate-400 text-xs truncate block max-w-[9rem]">{getValue<string | undefined>() ?? '—'}</span>,
      size: 140,
    },
    {
      id: 'depthChart',
      header: () => <HeaderTooltip label="DC" tip="Sleeper's depth-chart order at the position. DC1 = starter." />,
      accessorFn: (r) => r.depthChartOrder ?? undefined,
      sortUndefined: 'last',
      cell: ({ getValue }) => {
        const v = getValue<number | undefined>()
        return <span className="text-slate-400 text-xs tabular-nums">{v ? `DC${v}` : '—'}</span>
      },
      size: 56,
    },
    {
      id: 'searchRank',
      header: () => (
        <HeaderTooltip label="Rank" tip="Sleeper's consensus player rank — lower is more highly regarded. Unranked players sort last." />
      ),
      accessorFn: (r) => r.searchRank ?? undefined,
      sortUndefined: 'last',
      cell: ({ getValue }) => <span className="text-slate-400 text-xs tabular-nums">{getValue<number | undefined>() ?? '—'}</span>,
      size: 60,
    },
    {
      id: 'ytdPpg',
      header: () => <HeaderTooltip label="YTD PPG" tip={ytdTip} />,
      accessorFn: (r) => r.ytdPpg ?? undefined,
      sortUndefined: 'last',
      cell: ({ getValue }) => {
        if (needsLiveStats && liveStats.isLoading) return <span className="text-slate-600 text-xs">…</span>
        const v = getValue<number | undefined>()
        return <span className="text-slate-300 text-xs tabular-nums">{v != null ? v.toFixed(1) : '—'}</span>
      },
      size: 72,
    },
    {
      id: 'value',
      header: () => <HeaderTooltip label="Value" tip={ROOKIE_NOTE} />,
      accessorFn: (r) => r.scores.valueScore,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <ValueScoreBadge score={row.original.scores.valueScore} scores={row.original.scores} title={row.original.fullName} size="sm" />
          {row.original.scores.isProvisional && (
            <span className="text-[10px] text-amber-400" title="Provisional — reduced confidence">*</span>
          )}
        </div>
      ),
      size: 72,
    },
  ], [ytdTip, needsLiveStats, liveStats.isLoading])

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const sortedRows = table.getRowModel().rows

  return (
    <section>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <h2 className="text-lg font-bold text-white">{rookieSeason} Rookie Class</h2>
        <span className="text-xs text-slate-500 tabular-nums">{classRows.length} players</span>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Value is provisional (rookies × 0.85) and graded on the {season.selectedSeason} season.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setPosition(null)}
            data-active={position === null}
            className="px-2.5 py-1 rounded text-xs font-medium border border-slate-700 text-slate-400
              data-[active=true]:bg-slate-700/40 data-[active=true]:border-slate-500 data-[active=true]:text-white
              hover:border-slate-500 transition-colors"
          >
            All
          </button>
          {ROOKIE_POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => setPosition(pos)}
              data-active={position === pos}
              className="px-2.5 py-1 rounded text-xs font-medium border border-slate-700 text-slate-400
                data-[active=true]:border-violet-500 data-[active=true]:text-violet-300 data-[active=true]:bg-violet-950/30
                hover:border-slate-500 transition-colors"
            >
              {pos}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={startersOnly}
            onChange={(e) => setStartersOnly(e.target.checked)}
            className="accent-violet-500"
          />
          Starters only
        </label>
      </div>

      {classRows.length === 0 ? (
        <p className="text-slate-500 text-sm">No {rookieSeason} rookie data available yet.</p>
      ) : filteredRows.length === 0 ? (
        <p className="text-slate-500 text-sm">No rookies match the selected filters.</p>
      ) : (
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
              {sortedRows.map((row, i) => (
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
      )}
    </section>
  )
}
