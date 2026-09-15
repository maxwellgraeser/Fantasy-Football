import type { NFLTeam, FantasyPosition } from '@/types/sleeper'

interface Props {
  team: NFLTeam | null
  grade?: number
  position?: FantasyPosition
  showGrade?: boolean
}

function gradeColor(g: number): string {
  if (g >= 75) return 'text-emerald-400 bg-emerald-950/50 border-emerald-800/40'
  if (g >= 55) return 'text-sky-400 bg-sky-950/50 border-sky-800/40'
  if (g >= 40) return 'text-yellow-400 bg-yellow-950/50 border-yellow-800/40'
  return 'text-slate-400 bg-slate-800/50 border-slate-700/40'
}

export function TeamGradeChip({ team, grade, showGrade = true }: Props) {
  if (!team) return <span className="text-slate-600 text-xs">FA</span>

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono font-semibold
        border
        ${showGrade && grade !== undefined ? gradeColor(grade) : 'text-slate-400 bg-slate-800/50 border-slate-700/40'}
      `}
    >
      {team}
      {showGrade && grade !== undefined && (
        <span className="opacity-70 font-sans">{grade}</span>
      )}
    </span>
  )
}
