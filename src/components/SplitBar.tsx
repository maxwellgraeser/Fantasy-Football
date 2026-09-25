import { useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'

export interface SplitBarSegment {
  key: string
  label: string
  /** Tailwind background color class for the segment fill, e.g. "bg-violet-500". */
  color: string
}

interface SplitBarProps {
  segments: SplitBarSegment[]
  /** Integer percentages, one per segment, in the same order as `segments`. Must sum to 100. */
  values: number[]
  /** Fired on every change (drag, keyboard, or number input) — update local/draft state here. */
  onChange: (values: number[]) => void
  /** Fired once a change is "final" (pointer up, or a number input loses focus) — commit here. */
  onCommit?: (values: number[]) => void
  className?: string
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Redistribute a direct edit to segment `index` across the other segments so the total stays
 * 100. Takes the difference from the next segment first, then the previous one, then whatever
 * is left over (each clamped to 0–100) — so a single edit never breaks the 100% total.
 */
function redistribute(values: number[], index: number, rawNewValue: number): number[] {
  const n = values.length
  const newValue = clamp(Math.round(rawNewValue), 0, 100)
  const result = [...values]
  let delta = newValue - values[index]
  result[index] = newValue

  const order: number[] = []
  if (index + 1 < n) order.push(index + 1)
  if (index - 1 >= 0) order.push(index - 1)
  for (let k = 0; k < n; k++) if (k !== index && !order.includes(k)) order.push(k)

  for (const k of order) {
    if (delta === 0) break
    const current = result[k]
    const adjusted = clamp(current - delta, 0, 100)
    delta -= current - adjusted
    result[k] = adjusted
  }
  // Others were already at 0/100 and couldn't absorb the full delta — pull the edited
  // segment back so the total still sums to 100.
  if (delta !== 0) result[index] = clamp(result[index] - delta, 0, 100)
  return result
}

/**
 * One horizontal bar split into N colored, draggable segments that always sum to 100%.
 * Each of the N-1 handles sits on the boundary between two adjacent segments and moving it
 * only trades share between that pair, so every other segment (and the overall total) is
 * left untouched. Integer number inputs underneath give precise control.
 */
export function SplitBar({ segments, values, onChange, onCommit, className = '' }: SplitBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const cumulative = (upto: number) => values.slice(0, upto + 1).reduce((s, v) => s + v, 0)

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>, h: number) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    // Bounds for this handle are fixed for the whole drag: only the pair (h, h+1) changes,
    // so segments outside the pair — and therefore these cumulative bounds — never move.
    const lower = cumulative(h - 1)
    const upper = cumulative(h + 1)
    let latest = values

    const apply = (clientX: number) => {
      const pct = ((clientX - rect.left) / rect.width) * 100
      const pos = clamp(Math.round(pct), lower, upper)
      const next = [...values]
      next[h] = pos - lower
      next[h + 1] = upper - pos
      latest = next
      onChange(next)
    }
    apply(e.clientX)

    function onMove(ev: PointerEvent) {
      apply(ev.clientX)
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      onCommit?.(latest)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>, h: number) {
    const lower = cumulative(h - 1)
    const upper = cumulative(h + 1)
    const pos = lower + values[h]
    const step = e.shiftKey ? 5 : 1
    let target: number | null = null
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') target = pos - step
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') target = pos + step
    else if (e.key === 'Home') target = lower
    else if (e.key === 'End') target = upper
    if (target === null) return
    e.preventDefault()
    const clamped = clamp(target, lower, upper)
    const next = [...values]
    next[h] = clamped - lower
    next[h + 1] = upper - clamped
    onChange(next)
  }

  function handleInputChange(i: number, raw: string) {
    const parsed = raw === '' ? 0 : Number(raw)
    const next = redistribute(values, i, Number.isFinite(parsed) ? parsed : values[i])
    onChange(next)
  }

  return (
    <div className={className}>
      <div
        ref={trackRef}
        className="relative h-7 w-full rounded-md overflow-hidden flex bg-slate-800 select-none"
      >
        {segments.map((seg, i) => (
          <div
            key={seg.key}
            className={`h-full min-w-0 px-1 flex items-center justify-center gap-1 text-[10px] font-medium
              text-white/90 whitespace-nowrap overflow-hidden ${seg.color}`}
            style={{ width: `${values[i]}%` }}
            title={`${seg.label}: ${values[i]}%`}
          >
            {/* Label shortens with an ellipsis in narrow segments; the percentage always stays whole. */}
            {values[i] >= 14 && <span className="min-w-0 truncate">{seg.label}</span>}
            {values[i] >= 6 && <span className="shrink-0">{values[i]}%</span>}
          </div>
        ))}
        {segments.slice(0, -1).map((_, h) => {
          const pos = cumulative(h)
          return (
            <div
              key={h}
              role="slider"
              tabIndex={0}
              aria-label={`Boundary between ${segments[h].label} and ${segments[h + 1].label}`}
              aria-valuemin={cumulative(h - 1)}
              aria-valuemax={cumulative(h + 1)}
              aria-valuenow={pos}
              onPointerDown={(e) => handlePointerDown(e, h)}
              onKeyDown={(e) => handleKeyDown(e, h)}
              className="absolute top-0 h-full w-3 -ml-1.5 cursor-ew-resize touch-none
                flex items-center justify-center focus:outline-none group"
              style={{ left: `${pos}%` }}
            >
              <div className="h-full w-[3px] rounded-full bg-slate-950/60 group-hover:bg-violet-300
                group-focus-visible:bg-violet-300 group-focus-visible:ring-1 group-focus-visible:ring-violet-400" />
            </div>
          )
        })}
      </div>

      {/* Two columns keeps labels legible at drawer width (~420px, full width on mobile). */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        {segments.map((seg, i) => (
          <label key={seg.key} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className={`h-2 w-2 shrink-0 rounded-sm ${seg.color}`} aria-hidden="true" />
            <span className="truncate">{seg.label}</span>
            <span className="flex items-center ml-auto shrink-0">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={values[i]}
                onChange={(e) => handleInputChange(i, e.target.value)}
                onBlur={() => onCommit?.(values)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                aria-label={`${seg.label} percent`}
                className="w-11 rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-right
                  text-xs tabular-nums text-slate-200 focus:outline-none focus:border-violet-500"
              />
              <span className="ml-0.5 text-slate-500">%</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
