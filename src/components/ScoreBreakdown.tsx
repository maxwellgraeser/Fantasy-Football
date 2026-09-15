import { useState } from 'react'
import type { ValueScoreBreakdown } from '@/types/scoring'
import { ScoreBar } from './ValueScoreBadge'

interface Props {
  scores: ValueScoreBreakdown
}

function Section({
  title,
  grade,
  color,
  children,
}: {
  title: string
  grade: number
  color: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-sm font-medium text-slate-200">{title}</span>
        <div className="flex items-center gap-3">
          <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${color} transition-all duration-500`}
              style={{ width: `${grade}%` }}
            />
          </div>
          <span className="text-sm font-semibold tabular-nums text-slate-200 w-6 text-right">{grade}</span>
          <span className="text-slate-500 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2 bg-slate-900/30">
          {children}
        </div>
      )}
    </div>
  )
}

export function ScoreBreakdown({ scores }: Props) {
  const { playerBreakdown: pb, opportunityBreakdown: ob, teamBreakdown: tb } = scores

  return (
    <div className="space-y-2">
      {/* Composite */}
      <div className="flex items-center gap-3 px-1 mb-4">
        <span className="text-xs text-slate-500 uppercase tracking-widest">Composite Value Score</span>
        <div className="flex-1 h-px bg-slate-800" />
      </div>

      <ScoreBar value={scores.valueScore} label="Value Score" color="teal" />

      <div className="mt-4 space-y-2">
        <Section title="Player Grade" grade={scores.playerGrade} color="bg-blue-500">
          <ScoreBar value={pb.ppgPercentile} label="PPG Percentile" color="blue" />
          {scores.teamBreakdown.position !== 'DEF' && (
            <>
              <ScoreBar value={Math.max(0, Math.round(50 + pb.ageCurveAdj * 5))} label="Age Curve"   color="blue" />
              <ScoreBar value={pb.efficiencyPct} label="Efficiency" color="blue" />
            </>
          )}
          <ScoreBar value={Math.round(pb.durabilityPct)} label="Durability %" color="blue" />
          <div className="pt-1 text-xs text-slate-500">
            Avg PPG (weighted): {pb.recentPpg.toFixed(1)}
          </div>
        </Section>

        {scores.teamBreakdown.position !== 'DEF' && (
          <Section title="Opportunity Grade" grade={scores.opportunityGrade} color="bg-purple-500">
            <ScoreBar value={ob.depthChartScore} label="Depth Chart"  color="purple" />
            <ScoreBar value={ob.targetSharePct}  label="Target Share" color="purple" />
            <ScoreBar value={ob.touchSharePct}   label="Touch Share"  color="purple" />
            <ScoreBar value={ob.roleSteadiness}  label="Role Steady"  color="purple" />
          </Section>
        )}

        <Section title="Team Grade" grade={scores.teamGrade} color="bg-amber-500">
          {tb.rushAttPerGame !== undefined && (
            <ScoreBar value={Math.round(Math.min(tb.rushAttPerGame * 3.5, 100))} label="Rush Att/G" color="amber" />
          )}
          {tb.rushYdPerGame !== undefined && (
            <ScoreBar value={Math.round(Math.min(tb.rushYdPerGame / 2, 100))} label="Rush Yd/G" color="amber" />
          )}
          {tb.rzRushSharePct !== undefined && (
            <ScoreBar value={Math.round(Math.min(tb.rzRushSharePct * 6, 100))} label="RZ Rush %" color="amber" />
          )}
          {tb.passAttPerGame !== undefined && (
            <ScoreBar value={Math.round(Math.min(tb.passAttPerGame * 2.5, 100))} label="Pass Att/G" color="amber" />
          )}
          {tb.passYdPerGame !== undefined && (
            <ScoreBar value={Math.round(Math.min(tb.passYdPerGame / 4, 100))} label="Pass Yd/G" color="amber" />
          )}
          {tb.airYdPerGame !== undefined && (
            <ScoreBar value={Math.round(Math.min(tb.airYdPerGame / 3, 100))} label="Air Yd/G" color="amber" />
          )}
          {tb.neutralPassRate !== undefined && (
            <ScoreBar value={Math.round(tb.neutralPassRate)} label="Pass Rate" color="amber" />
          )}
          {tb.overallGrade !== undefined && (
            <div className="pt-1 text-xs text-slate-500">
              Team Grade (position): {tb.overallGrade}
            </div>
          )}
        </Section>
      </div>

      {scores.isProvisional && (
        <p className="text-xs text-amber-400/70 mt-2">
          ⚠ Rookie — score provisional, limited production data.
        </p>
      )}
    </div>
  )
}
