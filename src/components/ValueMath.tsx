import type { GradeKey, ValueContribution } from '@/types/scoring'

const SHORT_LABEL: Record<GradeKey, string> = {
  player: 'Player',
  opportunity: 'Opp',
  team: 'Team',
}

interface Props {
  contributions: ValueContribution[]
  rookieMultiplier: number
  valueScore: number
  /** Optional heading, e.g. the player's name. */
  title?: string
}

/**
 * Worked Value math:
 *   Player  88 × 55% = 48.4
 *   Opp     95 × 20% = 19.0
 *   Team    62 × 25% = 15.5
 *   ─────────────────────────
 *   Value            = 83
 */
export function ValueMath({ contributions, rookieMultiplier, valueScore, title }: Props) {
  return (
    <div className="text-xs tabular-nums text-slate-300 whitespace-nowrap">
      {title && <div className="font-semibold text-slate-100 mb-1.5 truncate">{title}</div>}
      <div className="space-y-0.5 font-mono">
        {contributions.map((c) => (
          <div key={c.key} className="flex items-baseline gap-2">
            <span className="w-12 text-slate-400">{SHORT_LABEL[c.key]}</span>
            {c.grade === null ? (
              <span className="flex-1 text-right text-slate-600">n/a</span>
            ) : (
              <span className="flex-1 text-right">
                {c.grade} × {Math.round(c.weight * 100)}%
              </span>
            )}
            <span className="w-14 text-right text-slate-200">
              {c.grade === null ? '' : `= ${c.points.toFixed(1)}`}
            </span>
          </div>
        ))}
        {rookieMultiplier !== 1 && (
          <div className="flex items-baseline gap-2 text-amber-300/80">
            <span className="w-12">Rookie</span>
            <span className="flex-1 text-right">× {rookieMultiplier}</span>
            <span className="w-14" />
          </div>
        )}
        <div className="flex items-baseline gap-2 border-t border-slate-700 mt-1.5 pt-1.5 font-semibold text-slate-100">
          <span className="w-12">Value</span>
          <span className="flex-1" />
          <span className="w-14 text-right">= {valueScore}</span>
        </div>
      </div>
    </div>
  )
}
