import { useState, type ReactNode } from 'react'
import type { GradeKey, ValueContribution, ValueScoreBreakdown } from '@/types/scoring'
import { ScoreBar } from './ValueScoreBadge'
import { ValueMath } from './ValueMath'
import { GRADE_EXPLANATIONS, ROOKIE_NOTE, DEF_NOTE } from '@/lib/scoring/explain'

interface Props {
  scores: ValueScoreBreakdown
}

const SECTION_LABEL: Record<GradeKey, string> = {
  player: 'Player',
  opportunity: 'Opportunity',
  team: 'Team',
}

const BAR_COLOR: Record<GradeKey, string> = {
  player: 'blue',
  opportunity: 'purple',
  team: 'amber',
}

const pct = (w: number) => `${Math.round(w * 100)}%`

/** "78th", "2nd", "13th" — used to label team-context league percentiles. */
function ordinal(n: number): string {
  const v = Math.round(n)
  const mod100 = v % 100
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`
  switch (v % 10) {
    case 1: return `${v}st`
    case 2: return `${v}nd`
    case 3: return `${v}rd`
    default: return `${v}th`
  }
}

/**
 * Expandable section for one grade. The header shows the worked contribution
 * ("Player 88 × 55% = 48.4"); expanding reveals the parts that feed the grade.
 * When the grade doesn't apply (DEF Opportunity/Team) it renders a plain n/a row.
 */
function Section({ contribution, children }: { contribution: ValueContribution; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { key, grade, weight, points } = contribution
  const label = SECTION_LABEL[key]

  if (grade === null) {
    return (
      <div className="border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className="text-xs text-slate-600">n/a</span>
      </div>
    )
  }

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {grade} × {pct(weight)} = {points.toFixed(1)}
          </span>
          <span className="text-slate-500 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && <div className="px-4 py-3 space-y-2 bg-slate-900/30">{children}</div>}
    </div>
  )
}

function findContribution(contributions: ValueContribution[], key: GradeKey): ValueContribution {
  return contributions.find((c) => c.key === key) ?? { key, label: SECTION_LABEL[key], grade: null, weight: 0, points: 0 }
}

export function ScoreBreakdown({ scores }: Props) {
  const { playerBreakdown: pb, opportunityBreakdown: ob, teamBreakdown: tb, contributions, rookieMultiplier, valueScore } = scores
  const [ppgPart, ageAdjPart, durabilityPart] = GRADE_EXPLANATIONS.player.parts
  const [depthPart, targetPart, touchPart, gamesPart] = GRADE_EXPLANATIONS.opportunity.parts

  return (
    <div className="space-y-4">
      {/* Worked math: grade × weight = points, for every applied grade */}
      <ValueMath contributions={contributions} rookieMultiplier={rookieMultiplier} valueScore={valueScore} />

      <div className="space-y-2">
        <Section contribution={findContribution(contributions, 'player')}>
          <ScoreBar value={Math.round(pb.ppgPercentile)} label={`${ppgPart.label} · ${pct(ppgPart.weight)}`} color={BAR_COLOR.player} />
          <ScoreBar value={Math.round(pb.ageAdjustedPct)} label={`${ageAdjPart.label} · ${pct(ageAdjPart.weight)}`} color={BAR_COLOR.player} />
          <ScoreBar value={Math.round(pb.durabilityPct)} label={`${durabilityPart.label} · ${pct(durabilityPart.weight)}`} color={BAR_COLOR.player} />
          <div className="pt-1 text-xs text-slate-500">Recency-weighted PPG: {pb.recentPpg.toFixed(1)}</div>
        </Section>

        <Section contribution={findContribution(contributions, 'opportunity')}>
          {ob && (
            <>
              <ScoreBar value={Math.round(ob.depthChartScore)} label={`${depthPart.label} · ${pct(depthPart.weight)}`} color={BAR_COLOR.opportunity} />
              <ScoreBar value={Math.round(ob.targetSharePct)} label={`${targetPart.label} · ${pct(targetPart.weight)}`} color={BAR_COLOR.opportunity} />
              <ScoreBar value={Math.round(ob.touchSharePct)} label={`${touchPart.label} · ${pct(touchPart.weight)}`} color={BAR_COLOR.opportunity} />
              <ScoreBar value={Math.round(ob.roleSteadiness)} label={`${gamesPart.label} · ${pct(gamesPart.weight)}`} color={BAR_COLOR.opportunity} />
            </>
          )}
        </Section>

        <Section contribution={findContribution(contributions, 'team')}>
          {tb && tb.metrics.map((m) => (
            <ScoreBar
              key={m.key}
              value={Math.round(m.percentile)}
              label={`${m.label} ${m.display} · ${ordinal(m.percentile)} pct`}
              color={BAR_COLOR.team}
            />
          ))}
        </Section>
      </div>

      {scores.opportunityGrade === null && (
        <p className="text-xs text-slate-500">{DEF_NOTE}</p>
      )}

      {rookieMultiplier !== 1 && (
        <p className="text-xs text-amber-400/70">⚠ {ROOKIE_NOTE}</p>
      )}
    </div>
  )
}
