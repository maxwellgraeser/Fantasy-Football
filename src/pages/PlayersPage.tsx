import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { useValueScores } from '@/hooks/useValueScores'
import { ValueScoreBadge } from '@/components/ValueScoreBadge'
import { TeamGradeChip } from '@/components/TeamGradeChip'
import { TrendSparkline } from '@/components/TrendSparkline'
import { PositionFilter, positionBadgeClass } from '@/components/PositionFilter'
import { WeightsDrawer } from '@/components/WeightsDrawer'
import { useWatchlistStore } from '@/store/watchlist'
import type { PlayerRow } from '@/types/scoring'
import type { FantasyPosition } from '@/types/sleeper'

export function PlayersPage() {
  const { rows, isLoading, error } = useValueScores()
  const navigate = useNavigate()
  const { toggle, has } = useWatchlistStore()

  const [positions, setPositions] = useState<FantasyPosition[]>([])
  const [includeRookies, setIncludeRookies] = useState(false)
  const [weightsOpen, setWeightsOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }])
  const [globalFilter, setGlobalFilter] = useState('')
  const [visibleCount, setVisibleCount] = useState(25)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    let r = rows
    // years_exp=1 = first-year NFL players (2025 class). Exclude by default to keep "proven" focus.
    if (!includeRookies) r = r.filter((p) => p.ppgHistory.some((h) => h.gp > 0) || p.position === 'DEF')
    if (positions.length > 0) r = r.filter((p) => positions.includes(p.position))
    return r
  }, [rows, includeRookies, positions])

  const columns = useMemo<ColumnDef<PlayerRow>[]>(
    () => [
      {
        id: 'rank',
        header: '#',
        cell: ({ row }) => (
          <span className="text-slate-500 text-xs tabular-nums">{row.index + 1}</span>
        ),
        enableSorting: false,
        size: 40,
      },
      {
        id: 'valueScore',
        header: 'Value',
        accessorFn: (r) => r.scores.valueScore,
        cell: ({ getValue }) => <ValueScoreBadge score={getValue<number>()} />,
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
        header: 'Pos',
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
        header: 'Team',
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
        header: 'Age',
        accessorFn: (r) => r.age,
        cell: ({ getValue }) => (
          <span className="text-slate-400 text-xs tabular-nums">{getValue<number | null>() ?? '—'}</span>
        ),
        size: 52,
      },
      {
        id: 'exp',
        header: 'Exp',
        accessorFn: (r) => r.yearsExp,
        cell: ({ getValue }) => (
          <span className="text-slate-400 text-xs tabular-nums">{getValue<number>()}yr</span>
        ),
        size: 52,
      },
      {
        id: 'playerGrade',
        header: 'Player',
        accessorFn: (r) => r.scores.playerGrade,
        cell: ({ getValue }) => (
          <span className="text-slate-300 text-xs tabular-nums font-medium">{getValue<number>()}</span>
        ),
        size: 60,
      },
      {
        id: 'oppGrade',
        header: 'Opp',
        accessorFn: (r) => r.scores.opportunityGrade,
        cell: ({ getValue }) => (
          <span className="text-slate-300 text-xs tabular-nums font-medium">{getValue<number>()}</span>
        ),
        size: 60,
      },
      {
        id: 'teamGrade',
        header: 'Team',
        accessorFn: (r) => r.scores.teamGrade,
        cell: ({ getValue }) => (
          <span className="text-slate-300 text-xs tabular-nums font-medium">{getValue<number>()}</span>
        ),
        size: 60,
      },
      {
        id: 'ppg',
        header: 'PPG',
        accessorFn: (r) => r.ppgHistory[0]?.ppg ?? 0,
        cell: ({ getValue }) => (
          <span className="text-slate-300 text-xs tabular-nums">{getValue<number>().toFixed(1)}</span>
        ),
        size: 60,
      },
      {
        id: 'trend',
        header: 'Trend',
        accessorFn: (r) => r.sparkline,
        cell: ({ getValue }) => <TrendSparkline data={getValue<number[]>()} />,
        enableSorting: false,
        size: 90,
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
    ],
    [has, toggle],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const allRows = table.getRowModel().rows
  const visibleRows = allRows.slice(0, visibleCount)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount((n) => Math.min(n + 25, allRows.length))
      }
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [allRows.length])
  // NOTE: visibleCount is intentionally excluded from deps. Including it would
  // recreate the observer after every load-more, firing immediately if the
  // sentinel is still visible and causing a rapid cascade.

  useEffect(() => {
    setVisibleCount(25)
  }, [positions, includeRookies, globalFilter, sorting])

  const handleRowClick = useCallback((row: PlayerRow) => {
    navigate(`/player/${row.playerId}`)
  }, [navigate])

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        Failed to load player data. Sleeper API may be unavailable.
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <WeightsDrawer open={weightsOpen} onClose={() => setWeightsOpen(false)} />

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h1 className="text-lg font-bold text-white mr-2">Players</h1>

        <PositionFilter selected={positions} onChange={setPositions} />

        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={includeRookies}
            onChange={(e) => setIncludeRookies(e.target.checked)}
            className="accent-violet-500"
          />
          Include rookies
        </label>

        <div className="flex-1" />

        <span className="text-xs text-slate-500 tabular-nums">{filtered.length} players</span>

        <button
          onClick={() => setWeightsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 border border-slate-700
            rounded-lg hover:border-violet-500 hover:text-violet-300 transition-colors"
        >
          ⚙ Weights
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-800/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-800 bg-slate-900/60">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={header.column.getCanSort() ? 'cursor-pointer hover:text-slate-300 flex items-center gap-1' : ''}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' && ' ↑'}
                          {header.column.getIsSorted() === 'desc' && ' ↓'}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => handleRowClick(row.original)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-3 py-2"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div ref={sentinelRef} className="h-1" />
        <p className="text-xs text-slate-500 text-center py-3 tabular-nums">
          {visibleCount < allRows.length
            ? `Showing ${Math.min(visibleCount, allRows.length)} of ${allRows.length} players`
            : `All ${allRows.length} players loaded`}
        </p>
        </>
      )}
    </div>
  )
}
