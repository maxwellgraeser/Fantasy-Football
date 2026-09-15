import { useMemo, useCallback, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from '@tanstack/react-table'
import { useNavigate } from 'react-router-dom'
import { useValueScores } from '@/hooks/useValueScores'
import { usePlayers } from '@/hooks/usePlayers'
import { useWatchlistStore } from '@/store/watchlist'
import { useWeightsStore } from '@/store/weights'
import { usePlayerColumns } from '@/components/playerColumns'
import { positionBadgeClass, playerName } from '@/lib/positions'
import type { PlayerRow } from '@/types/scoring'

export function WatchlistPage() {
  const { rows, isLoading, error, season, scoringFormat } = useValueScores()
  const players = usePlayers()
  const { playerIds, toggle, has } = useWatchlistStore()
  const weights = useWeightsStore((s) => s.weights)
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>([{ id: 'valueScore', desc: true }])

  const active = useMemo(
    () => rows.filter((r) => playerIds.includes(r.playerId)),
    [rows, playerIds],
  )

  const missingIds = useMemo(
    () => (isLoading ? [] : playerIds.filter((id) => !rows.some((r) => r.playerId === id))),
    [isLoading, rows, playerIds],
  )

  const columns = usePlayerColumns({
    has,
    toggle,
    weights,
    selectedSeason: season.selectedSeason,
    scoringFormat,
    isInProgress: season.isInProgress,
  })

  const table = useReactTable({
    data: active,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const allRows = table.getRowModel().rows

  const handleRowClick = useCallback(
    (row: PlayerRow) => navigate(`/player/${row.playerId}`),
    [navigate],
  )

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        Failed to load player data. Sleeper API may be unavailable.
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-lg font-bold text-white">Watchlist</h1>
        <span className="text-xs text-slate-500 tabular-nums">
          {isLoading ? playerIds.length : allRows.length + missingIds.length} players
        </span>
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
        <>
          {allRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-800">
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
                  {allRows.map((row, i) => (
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
          )}

          {missingIds.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2">No longer active</p>
              <div className="rounded-lg border border-slate-800 divide-y divide-slate-800/50">
                {missingIds.map((id) => {
                  const p = players.data?.[id]
                  return (
                    <div key={id} className="flex items-center gap-3 px-3 py-2">
                      {p ? (
                        <>
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${positionBadgeClass(p.fantasy_positions?.[0] ?? p.position)}`}>
                            {p.fantasy_positions?.[0] ?? p.position}
                          </span>
                          <span className="flex-1 text-sm text-slate-500 truncate">{playerName(p)}</span>
                        </>
                      ) : (
                        <span className="flex-1 text-sm text-slate-600 truncate">Unknown player ({id})</span>
                      )}
                      <button
                        onClick={() => toggle(id)}
                        className="shrink-0 text-xs text-slate-500 hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
