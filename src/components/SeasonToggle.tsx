import type { SeasonContext } from '@/hooks/useSeasonContext'

interface Props {
  season: SeasonContext
  gamesInSelectedSeason: number
}

/** Segmented control: last completed season vs. current season-to-date. */
export function SeasonToggle({ season, gamesInSelectedSeason }: Props) {
  const { completedSeason, inProgressSeason, week, mode, isInProgress, setMode } = season

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center rounded-lg border border-slate-700 overflow-hidden text-xs">
        <button
          onClick={() => setMode('completed')}
          data-active={mode === 'completed'}
          className="px-2.5 py-1 font-medium text-slate-400 whitespace-nowrap
            data-[active=true]:bg-slate-700/40 data-[active=true]:text-white
            hover:text-slate-200 transition-colors"
        >
          {completedSeason} · Full season
        </button>
        {inProgressSeason && (
          <button
            onClick={() => setMode('current')}
            data-active={mode === 'current'}
            className="px-2.5 py-1 font-medium text-slate-400 whitespace-nowrap border-l border-slate-700
              data-[active=true]:bg-violet-600/20 data-[active=true]:text-violet-300
              hover:text-slate-200 transition-colors"
          >
            {inProgressSeason} · Week {week ?? '?'}
          </button>
        )}
      </div>
      {isInProgress && (
        <span className="text-[11px] text-amber-400/80">
          Week {week ?? '?'} · {gamesInSelectedSeason} game{gamesInSelectedSeason === 1 ? '' : 's'} played — scores are volatile
        </span>
      )}
    </div>
  )
}
