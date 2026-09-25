import { Tooltip } from './Tooltip'
import type { SeasonLine } from '@/types/scoring'

interface Props {
  data: SeasonLine[]
  width?: number
  height?: number
}

const PAD_Y = 3

/** PPG at the precision it's displayed, so float noise between equal seasons can't draw a spike or a "−0.0" drop. */
const round1 = (n: number) => Math.round(n * 10) / 10

/** Lightweight inline-SVG sparkline (no recharts — this renders once per table row). */
export function TrendSparkline({ data, width = 56, height = 24 }: Props) {
  if (!data || data.length === 0) {
    return <span className="text-slate-600 text-xs">—</span>
  }

  const tooltipContent = (
    <div className="space-y-0.5">
      {data.map((d) => (
        <div key={d.season} className="flex justify-between gap-3 tabular-nums">
          <span>{d.season}{d.inProgress ? ' (in progress)' : ''}</span>
          <span>{d.ppg.toFixed(1)} PPG · {d.gp} GP</span>
        </div>
      ))}
    </div>
  )

  if (data.length === 1) {
    return (
      <Tooltip content={tooltipContent} width={200}>
        <svg width={width} height={height} className="inline-block align-middle">
          <circle cx={width / 2} cy={height / 2} r={2.5} fill="#64748b" />
        </svg>
      </Tooltip>
    )
  }

  const values = data.map((d) => round1(d.ppg))
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data.map((d, i) => ({
    x: i * stepX,
    y: height - PAD_Y - ((round1(d.ppg) - min) / range) * (height - PAD_Y * 2),
    d,
  }))

  const delta = round1(values[values.length - 1] - values[values.length - 2])
  const rising = delta >= 0
  const color = rising ? '#34d399' : '#f87171'

  return (
    <Tooltip content={tooltipContent} width={220}>
      <div className="inline-flex items-center gap-1.5">
        <svg width={width} height={height} className="shrink-0 overflow-visible">
          {points.slice(1).map((p, i) => {
            const prevP = points[i]
            const isLastSeg = i === points.length - 2
            const dashed = isLastSeg && p.d.inProgress
            return (
              <line
                key={p.d.season}
                x1={prevP.x}
                y1={prevP.y}
                x2={p.x}
                y2={p.y}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray={dashed ? '3,2' : undefined}
              />
            )
          })}
          {points.map((p, i) => {
            const isLast = i === points.length - 1
            const hollow = isLast && p.d.inProgress
            return (
              <circle
                key={p.d.season}
                cx={p.x}
                cy={p.y}
                r={isLast ? 2.2 : 1.4}
                fill={hollow ? '#0f1117' : color}
                stroke={color}
                strokeWidth={hollow ? 1.3 : 0}
              />
            )
          })}
        </svg>
        <span className={`text-[10px] tabular-nums font-medium whitespace-nowrap ${rising ? 'text-emerald-400' : 'text-red-400'}`}>
          {rising ? '▲' : '▼'} {delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)}
        </span>
      </div>
    </Tooltip>
  )
}
