interface Props {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 65) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  if (score >= 35) return 'text-orange-400'
  return 'text-red-400'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-emerald-950/60 border-emerald-700/40'
  if (score >= 65) return 'bg-green-950/60 border-green-700/40'
  if (score >= 50) return 'bg-yellow-950/60 border-yellow-700/40'
  if (score >= 35) return 'bg-orange-950/60 border-orange-700/40'
  return 'bg-red-950/60 border-red-700/40'
}

export function ValueScoreBadge({ score, size = 'md', showLabel = false }: Props) {
  const sizeClasses = {
    sm: 'text-xs w-8 h-8',
    md: 'text-sm w-10 h-10',
    lg: 'text-2xl w-16 h-16 font-bold',
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`
          ${sizeClasses[size]}
          ${scoreColor(score)}
          ${scoreBg(score)}
          rounded-lg border font-semibold
          flex items-center justify-center
          tabular-nums
        `}
      >
        {score}
      </div>
      {showLabel && <span className="text-xs text-slate-500">Value</span>}
    </div>
  )
}

/** Horizontal color bar, 0–100 */
export function ScoreBar({ value, label, color = 'blue' }: { value: number; label: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    teal: 'bg-teal-500',
    emerald: 'bg-emerald-500',
  }
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-xs text-slate-400 w-24 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colors[color] ?? 'bg-blue-500'} transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-slate-300 tabular-nums w-6 text-right">{value}</span>
    </div>
  )
}
