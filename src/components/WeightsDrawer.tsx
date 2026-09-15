import { useWeightsStore } from '@/store/weights'
import type { ScoringWeights } from '@/types/scoring'

interface Props {
  open: boolean
  onClose: () => void
}

function Slider({
  label,
  desc,
  value,
  onChange,
}: {
  label: string
  desc: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="text-xs tabular-nums text-slate-400">{(value * 100).toFixed(0)}%</span>
      </div>
      <p className="text-xs text-slate-500 mb-1">{desc}</p>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-violet-500 bg-slate-700 rounded-full cursor-pointer"
      />
    </div>
  )
}

export function WeightsDrawer({ open, onClose }: Props) {
  const { weights, setWeights, reset } = useWeightsStore()

  function handleMainWeight(key: keyof ScoringWeights, value: number) {
    // When one changes, normalize the other two to keep total = 1
    const others: Array<keyof ScoringWeights> = (['wPlayer', 'wOpportunity', 'wTeam'] as const).filter(
      (k) => k !== key,
    )
    const remaining = 1 - value
    const currentOtherSum = (others.reduce((s, k) => s + weights[k], 0) as number) || 1
    const normalized = Object.fromEntries(
      others.map((k) => [k, parseFloat(((weights[k] / currentOtherSum) * remaining).toFixed(2))]),
    )
    setWeights({ [key]: value, ...normalized } as Partial<ScoringWeights>)
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed right-0 top-0 h-full w-80 bg-[#151823] border-l border-slate-700/50
          z-50 transform transition-transform duration-300 ease-in-out
          flex flex-col
          ${open ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
          <h2 className="text-sm font-semibold text-slate-200">Scoring Weights</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Main component weights */}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Component Weights</p>
            <div className="space-y-4">
              <Slider
                label="Player Grade"
                desc="Raw production, efficiency, age curve, durability"
                value={weights.wPlayer}
                onChange={(v) => handleMainWeight('wPlayer', v)}
              />
              <Slider
                label="Opportunity Grade"
                desc="Depth chart, target/touch share, role stability"
                value={weights.wOpportunity}
                onChange={(v) => handleMainWeight('wOpportunity', v)}
              />
              <Slider
                label="Team Grade"
                desc="Offensive context for this player's position"
                value={weights.wTeam}
                onChange={(v) => handleMainWeight('wTeam', v)}
              />
            </div>
          </div>

          {/* Recency weights */}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Season Recency</p>
            <div className="space-y-4">
              <Slider
                label="This Season"
                desc="Weight of the most recent season"
                value={weights.recencyY1}
                onChange={(v) => setWeights({ recencyY1: v })}
              />
              <Slider
                label="1 Year Ago"
                desc="Weight of the previous season"
                value={weights.recencyY2}
                onChange={(v) => setWeights({ recencyY2: v })}
              />
              <Slider
                label="2 Years Ago"
                desc="Weight of 2 seasons back"
                value={weights.recencyY3}
                onChange={(v) => setWeights({ recencyY3: v })}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-700/50">
          <button
            onClick={reset}
            className="w-full py-2 text-xs text-slate-400 border border-slate-700 rounded
              hover:border-slate-500 hover:text-slate-300 transition-colors"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </>
  )
}
