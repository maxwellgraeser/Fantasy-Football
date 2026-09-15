import { useValueScores } from '@/hooks/useValueScores'
import { RookieClassSection } from '@/components/rookies/RookieClassSection'
import { SecondYearSection } from '@/components/rookies/SecondYearSection'

/**
 * Rookies page — built entirely from Sleeper data (no hand-curated draft board):
 * this year's rookie class (Section 1) and last year's class as breakout
 * candidates (Section 2). See docs/2026-09-14-improvement-plan.md §8.
 */
export function RookiesPage() {
  const { rows, isLoading, error, season, scoringFormat } = useValueScores()

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400 text-sm">
        Failed to load player data. Sleeper API may be unavailable.
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-800/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <RookieClassSection rows={rows} season={season} scoringFormat={scoringFormat} />
          <SecondYearSection rows={rows} season={season} scoringFormat={scoringFormat} />
        </>
      )}
    </div>
  )
}
