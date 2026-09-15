import { useSettingsStore } from '@/store/settings'
import { SCORING_FORMAT_LABELS } from '@/lib/scoring/format'
import type { ScoringFormat } from '@/types/scoring'

const FORMATS: ScoringFormat[] = ['half_ppr', 'ppr', 'std']

/** Compact segmented control for the scoring format used across PPG / grades. */
export function ScoringFormatToggle() {
  const format = useSettingsStore((s) => s.scoringFormat)
  const setFormat = useSettingsStore((s) => s.setScoringFormat)

  return (
    <div className="flex items-center rounded-lg border border-slate-700 overflow-hidden text-xs">
      {FORMATS.map((f, i) => (
        <button
          key={f}
          onClick={() => setFormat(f)}
          data-active={format === f}
          className={`px-2.5 py-1 font-medium text-slate-400 whitespace-nowrap transition-colors
            data-[active=true]:bg-slate-700/40 data-[active=true]:text-white hover:text-slate-200
            ${i > 0 ? 'border-l border-slate-700' : ''}`}
        >
          {SCORING_FORMAT_LABELS[f]}
        </button>
      ))}
    </div>
  )
}
