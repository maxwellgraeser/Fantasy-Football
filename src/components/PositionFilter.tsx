import type { FantasyPosition } from '@/types/sleeper'

const POSITIONS: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE', 'DEF']

interface Props {
  selected: FantasyPosition[]
  onChange: (positions: FantasyPosition[]) => void
}

const posColor: Record<string, string> = {
  QB:  'data-[active=true]:bg-rose-600/20 data-[active=true]:border-rose-500 data-[active=true]:text-rose-300',
  RB:  'data-[active=true]:bg-emerald-600/20 data-[active=true]:border-emerald-500 data-[active=true]:text-emerald-300',
  WR:  'data-[active=true]:bg-sky-600/20 data-[active=true]:border-sky-500 data-[active=true]:text-sky-300',
  TE:  'data-[active=true]:bg-amber-600/20 data-[active=true]:border-amber-500 data-[active=true]:text-amber-300',
  DEF: 'data-[active=true]:bg-violet-600/20 data-[active=true]:border-violet-500 data-[active=true]:text-violet-300',
}

export function positionBadgeClass(pos: string): string {
  const map: Record<string, string> = {
    QB:  'text-rose-300 bg-rose-950/50',
    RB:  'text-emerald-300 bg-emerald-950/50',
    WR:  'text-sky-300 bg-sky-950/50',
    TE:  'text-amber-300 bg-amber-950/50',
    DEF: 'text-violet-300 bg-violet-950/50',
  }
  return map[pos] ?? 'text-slate-400 bg-slate-800/50'
}

export function PositionFilter({ selected, onChange }: Props) {
  function toggle(pos: FantasyPosition) {
    if (selected.includes(pos)) {
      onChange(selected.filter((p) => p !== pos))
    } else {
      onChange([...selected, pos])
    }
  }

  const allSelected = selected.length === 0

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange([])}
        data-active={allSelected}
        className="px-2.5 py-1 rounded text-xs font-medium border border-slate-700 text-slate-400
          data-[active=true]:bg-slate-700/40 data-[active=true]:border-slate-500 data-[active=true]:text-white
          hover:border-slate-500 transition-colors"
      >
        All
      </button>
      {POSITIONS.map((pos) => (
        <button
          key={pos}
          onClick={() => toggle(pos)}
          data-active={selected.includes(pos)}
          className={`
            px-2.5 py-1 rounded text-xs font-medium border border-slate-700 text-slate-400
            hover:border-slate-500 transition-colors
            ${posColor[pos]}
          `}
        >
          {pos}
        </button>
      ))}
    </div>
  )
}
