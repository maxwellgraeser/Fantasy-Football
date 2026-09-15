import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { useValueScores } from '@/hooks/useValueScores'
import { usePlayerColumns, DEFAULT_FILTER_POSITIONS } from '@/components/playerColumns'
import { PositionFilter } from '@/components/PositionFilter'
import { SeasonToggle } from '@/components/SeasonToggle'
import { ScoringFormatToggle } from '@/components/ScoringFormatToggle'
import { WeightsDrawer } from '@/components/WeightsDrawer'
import { useWatchlistStore } from '@/store/watchlist'
import { useWeightsStore } from '@/store/weights'
import { isDefaultWeights } from '@/lib/scoring/presets'
import type { PlayerRow } from '@/types/scoring'
import type { FantasyPosition } from '@/types/sleeper'

export function PlayersPage() {
  const { rows, isLoading, error, season, gamesInSelectedSeason, scoringFormat, isRecomputing } = useValueScores()
  const navigate = useNavigate()
  const { toggle, has } = useWatchlistStore()
  const { weights, reset: resetWeights } = useWeightsStore()

  const [positions, setPositions] = useState<FantasyPosition[]>([])
  const [includeRookies, setIncludeRookies] = useState(false)
  const [weightsOpen, setWeightsOpen] = useState(false)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }])
  const [nameFilter, setNameFilter] = useState('')
  const [visibleCount, setVisibleCount] = useState(25)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const isCustomWeights = !isDefaultWeights(weights)

  const filtered = useMemo(() => {
    let r = rows
    // Hide players with no NFL games in the loaded seasons unless rookies are included
    if (!includeRookies) r = r.filter((p) => p.ppgHistory.some((h) => h.gp > 0) || p.position === 'DEF')
    const effectivePositions = positions.length > 0 ? positions : DEFAULT_FILTER_POSITIONS
    r = r.filter((p) => effectivePositions.includes(p.position))
    return r
  }, [rows, includeRookies, positions])

  const columns = usePlayerColumns({
    has,
    toggle,
    weights,
    selectedSeason: season.selectedSeason,
    scoringFormat,
    isInProgress: season.isInProgress,
  })

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter: nameFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setNameFilter,
    globalFilterFn: (row, _columnId, value: string) =>
      row.original.fullName.toLowerCase().includes(value.toLowerCase()),
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
  }, [positions, includeRookies, nameFilter, sorting])

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
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-lg font-bold text-white mr-2">Players</h1>

        <SeasonToggle season={season} gamesInSelectedSeason={gamesInSelectedSeason} />
        <ScoringFormatToggle />
        <PositionFilter selected={positions} onChange={setPositions} />

        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeRookies}
            onChange={(e) => setIncludeRookies(e.target.checked)}
            className="accent-violet-500"
          />
          Include rookies
        </label>

        <input
          type="text"
          value={nameFilter}
          onChange={(e) => setNameFilter(e.target.value)}
          placeholder="Filter by name…"
          className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200
            placeholder:text-slate-600 focus:outline-none focus:border-violet-500 w-36"
        />

        <div className="flex-1" />

        {isRecomputing && (
          <span className="text-xs text-slate-500 animate-pulse">Updating…</span>
        )}

        <span className="text-xs text-slate-500 tabular-nums">{filtered.length} players</span>

        {isCustomWeights && (
          <button
            onClick={resetWeights}
            title="Reset to default weights"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-violet-300 bg-violet-950/40
              border border-violet-800/50 rounded-full hover:bg-violet-900/40 transition-colors"
          >
            Custom weights · Reset
          </button>
        )}

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
        <div className="space-y-2 mt-3">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-800/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
        <div className="overflow-x-auto rounded-lg border border-slate-800 mt-3">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-slate-800 bg-slate-900/60">
                  {hg.headers.map((header) => {
                    const sticky = header.column.id === 'name'
                    return (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        style={{ width: header.getSize() }}
                        className={`px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wider select-none
                          ${header.colSpan > 1 ? 'text-center' : ''}
                          ${sticky ? 'sticky left-0 z-20 bg-slate-900' : ''}`}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={`flex items-center gap-1 ${header.colSpan > 1 ? 'justify-center' : ''} ${header.column.getCanSort() ? 'cursor-pointer hover:text-slate-300' : ''}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === 'asc' && ' ↑'}
                            {header.column.getIsSorted() === 'desc' && ' ↓'}
                          </div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {visibleRows.map((row, i) => (
                <tr
                  key={row.id}
                  onClick={() => handleRowClick(row.original)}
                  className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer transition-colors"
                >
                  {row.getVisibleCells().map((cell) => {
                    const sticky = cell.column.id === 'name'
                    return (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className={`px-3 py-2 ${sticky ? 'sticky left-0 z-10 bg-[#0f1117]' : ''}`}
                      >
                        {cell.column.id === 'rank' ? (
                          <span className="text-slate-500 text-xs tabular-nums">{i + 1}</span>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </td>
                    )
                  })}
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
