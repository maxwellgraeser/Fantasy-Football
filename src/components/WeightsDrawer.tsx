import { useEffect, useMemo, useState } from 'react'
import { useWeightsStore } from '@/store/weights'
import { useValueScores } from '@/hooks/useValueScores'
import { computeValue, normalizeGradeWeights, normalizeRecency, type GradeSet } from '@/lib/scoring/value'
import { WEIGHT_PRESETS, matchesPreset } from '@/lib/scoring/presets'
import { GRADE_EXPLANATIONS, TEAM_CONTEXT_BY_POSITION, ROOKIE_NOTE, DEF_NOTE } from '@/lib/scoring/explain'
import { DEFAULT_WEIGHTS, type PlayerRow, type ScoringWeights } from '@/types/scoring'
import { SplitBar, type SplitBarSegment } from './SplitBar'
import { ValueMath } from './ValueMath'

interface Props {
  open: boolean
  onClose: () => void
}

const GRADE_SEGMENTS: SplitBarSegment[] = [
  { key: 'wPlayer', label: 'Player', color: 'bg-violet-500' },
  { key: 'wOpportunity', label: 'Opportunity', color: 'bg-sky-500' },
  { key: 'wTeam', label: 'Team', color: 'bg-amber-500' },
]

const RECENCY_COLORS = ['bg-violet-500', 'bg-sky-500', 'bg-amber-500']

function weightsEqual(a: ScoringWeights, b: ScoringWeights): boolean {
  return (
    a.wPlayer === b.wPlayer &&
    a.wOpportunity === b.wOpportunity &&
    a.wTeam === b.wTeam &&
    a.recencyY1 === b.recencyY1 &&
    a.recencyY2 === b.recencyY2 &&
    a.recencyY3 === b.recencyY3
  )
}

/** Fractions (summing to 1) -> integer percents (summing to 100), largest-remainder method. */
function toPercents(fractions: readonly number[]): number[] {
  const raw = fractions.map((f) => f * 100)
  const floors = raw.map(Math.floor)
  const remainder = Math.round(100 - floors.reduce((s, v) => s + v, 0))
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
  const result = [...floors]
  for (let k = 0; k < remainder; k++) result[order[k % order.length].i] += 1
  return result
}

function gradeSetFor(row: PlayerRow): GradeSet {
  return {
    playerGrade: row.scores.playerGrade,
    opportunityGrade: row.scores.opportunityGrade,
    teamGrade: row.scores.teamGrade,
    isRookie: row.scores.isRookie,
  }
}

export function WeightsDrawer({ open, onClose }: Props) {
  const { weights: storeWeights, setWeights, reset } = useWeightsStore()
  const { rows, season } = useValueScores()

  // Local "draft" weights: dragging updates this instantly for a responsive UI, and it's
  // committed to the shared store ~150ms after the last change (or immediately on pointer
  // up / preset click), so heavy recompute in ScoresProvider doesn't run on every tick.
  const [draft, setDraft] = useState<ScoringWeights>(storeWeights)

  // Resync if the store changes from outside the drawer (e.g. a reset elsewhere). This is the
  // "adjust state when a prop changes" pattern — a conditional setState during render, not in
  // an effect — so the drawer never shows a stale draft for a render.
  const [syncedStoreWeights, setSyncedStoreWeights] = useState(storeWeights)
  if (storeWeights !== syncedStoreWeights) {
    setSyncedStoreWeights(storeWeights)
    setDraft(storeWeights)
  }

  // Debounced commit.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!weightsEqual(draft, storeWeights)) setWeights(draft)
    }, 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft])

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function commitDraft(next: ScoringWeights) {
    setDraft(next)
    if (!weightsEqual(next, storeWeights)) setWeights(next)
  }

  function handleReset() {
    reset()
    setDraft({ ...DEFAULT_WEIGHTS })
  }

  function applyPreset(weights: Pick<ScoringWeights, 'wPlayer' | 'wOpportunity' | 'wTeam'>) {
    commitDraft({ ...draft, ...weights })
  }

  // ── Grade weights split bar ──────────────────────────────────────────────
  const gradeNorm = normalizeGradeWeights(draft)
  const gradeValues = toPercents([gradeNorm.player, gradeNorm.opportunity, gradeNorm.team])

  function onGradeChange(pcts: number[]) {
    setDraft((prev) => ({ ...prev, wPlayer: pcts[0] / 100, wOpportunity: pcts[1] / 100, wTeam: pcts[2] / 100 }))
  }
  function onGradeCommit(pcts: number[]) {
    commitDraft({ ...draft, wPlayer: pcts[0] / 100, wOpportunity: pcts[1] / 100, wTeam: pcts[2] / 100 })
  }

  // ── Recency weights split bar ────────────────────────────────────────────
  const recencyNorm = normalizeRecency(draft)
  const recencyValues = toPercents(recencyNorm)
  const recencySegments: SplitBarSegment[] = useMemo(() => {
    const seasons = season.seasonsToLoad
    const label = (i: number) => (i === 0 && season.isInProgress ? `${seasons[i]} (to date)` : seasons[i] ?? `Y${i + 1}`)
    return [0, 1, 2].map((i) => ({ key: `recencyY${i + 1}`, label: label(i), color: RECENCY_COLORS[i] }))
  }, [season.seasonsToLoad, season.isInProgress])

  function onRecencyChange(pcts: number[]) {
    setDraft((prev) => ({ ...prev, recencyY1: pcts[0] / 100, recencyY2: pcts[1] / 100, recencyY3: pcts[2] / 100 }))
  }
  function onRecencyCommit(pcts: number[]) {
    commitDraft({ ...draft, recencyY1: pcts[0] / 100, recencyY2: pcts[1] / 100, recencyY3: pcts[2] / 100 })
  }

  // ── Live worked example ──────────────────────────────────────────────────
  const examplePool = useMemo(() => rows.filter((r) => r.position !== 'DEF').slice(0, 50), [rows])
  const [exampleId, setExampleId] = useState<string | null>(null)
  const exampleRow = examplePool.find((r) => r.playerId === exampleId) ?? examplePool[0] ?? null
  const exampleResult = exampleRow ? computeValue(gradeSetFor(exampleRow), draft) : null

  // ── Biggest movers: draft weights vs. shipped defaults, ranked over the top ~150 ────────
  const isBalanced = matchesPreset(draft, WEIGHT_PRESETS[0])
  const movers = useMemo(() => {
    const pool = rows.filter((r) => r.position !== 'DEF').slice(0, 150)
    if (pool.length === 0 || isBalanced) return null

    const rankBy = (weights: ScoringWeights) => {
      const scored = pool
        .map((r) => ({ id: r.playerId, value: computeValue(gradeSetFor(r), weights).valueScore }))
        .sort((a, b) => b.value - a.value)
      const rank = new Map<string, number>()
      scored.forEach((s, i) => rank.set(s.id, i + 1))
      return rank
    }
    const draftRank = rankBy(draft)
    const defaultRank = rankBy(DEFAULT_WEIGHTS)
    const deltas = pool.map((r) => {
      const rankDraft = draftRank.get(r.playerId)!
      const rankDefault = defaultRank.get(r.playerId)!
      return { id: r.playerId, name: r.fullName, rankDraft, rankDefault, delta: rankDefault - rankDraft }
    })
    const risers = deltas.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5)
    const fallers = deltas.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5)
    return { risers, fallers }
  }, [rows, draft, isBalanced])

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="weights-drawer-title"
        className="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-[#151823] border-l border-slate-700/50
          z-50 flex flex-col shadow-2xl"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-700/50 shrink-0">
          <h2 id="weights-drawer-title" className="text-sm font-semibold text-slate-200">Scoring Weights</h2>
          <button
            onClick={onClose}
            aria-label="Close weights panel"
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Presets */}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {WEIGHT_PRESETS.map((preset) => {
                const active = matchesPreset(draft, preset)
                return (
                  <button
                    key={preset.key}
                    type="button"
                    title={preset.description}
                    onClick={() => applyPreset(preset.weights)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      active
                        ? 'bg-violet-600/25 border-violet-500 text-violet-200'
                        : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {preset.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Grade weights */}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Component Weights</p>
            <SplitBar segments={GRADE_SEGMENTS} values={gradeValues} onChange={onGradeChange} onCommit={onGradeCommit} />
          </div>

          {/* Live worked example */}
          <div>
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-xs uppercase tracking-widest text-slate-500">Worked Example</p>
              {examplePool.length > 0 && (
                <select
                  value={exampleRow?.playerId ?? ''}
                  onChange={(e) => setExampleId(e.target.value)}
                  className="max-w-[55%] rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5
                    text-[11px] text-slate-300 focus:outline-none focus:border-violet-500"
                >
                  {examplePool.map((r) => (
                    <option key={r.playerId} value={r.playerId}>
                      {r.fullName} ({r.position}{r.team ? `, ${r.team}` : ''})
                    </option>
                  ))}
                </select>
              )}
            </div>
            {exampleResult ? (
              <div className="rounded-md border border-slate-700/50 bg-slate-900/40 p-3">
                <ValueMath
                  contributions={exampleResult.contributions}
                  rookieMultiplier={exampleResult.rookieMultiplier}
                  valueScore={exampleResult.valueScore}
                  title={exampleRow?.fullName}
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500">No players loaded yet.</p>
            )}
          </div>

          {/* Biggest movers */}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-2">Biggest Movers</p>
            {isBalanced || !movers ? (
              <p className="text-xs text-slate-500">
                Adjust the weights above to see who rises and falls vs. the Balanced defaults.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-emerald-400/80 font-medium mb-1">Risers</p>
                  <ul className="space-y-1">
                    {movers.risers.length === 0 && <li className="text-slate-600">None</li>}
                    {movers.risers.map((m) => (
                      <li key={m.id} className="flex items-baseline gap-1 text-slate-300">
                        <span className="text-emerald-400 tabular-nums">▲{m.delta}</span>
                        <span className="truncate">{m.name}</span>
                        <span className="ml-auto text-slate-500 tabular-nums shrink-0">
                          #{m.rankDefault}→#{m.rankDraft}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-rose-400/80 font-medium mb-1">Fallers</p>
                  <ul className="space-y-1">
                    {movers.fallers.length === 0 && <li className="text-slate-600">None</li>}
                    {movers.fallers.map((m) => (
                      <li key={m.id} className="flex items-baseline gap-1 text-slate-300">
                        <span className="text-rose-400 tabular-nums">▼{Math.abs(m.delta)}</span>
                        <span className="truncate">{m.name}</span>
                        <span className="ml-auto text-slate-500 tabular-nums shrink-0">
                          #{m.rankDefault}→#{m.rankDraft}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Plain-language explanations */}
          <details className="group rounded-md border border-slate-700/50 bg-slate-900/40 p-3">
            <summary className="cursor-pointer text-xs font-medium text-slate-300 select-none">
              What feeds each grade?
            </summary>
            <div className="mt-3 space-y-3 text-[11px] leading-relaxed text-slate-400">
              <div>
                <p className="text-slate-300 font-medium">{GRADE_EXPLANATIONS.player.title}</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  {GRADE_EXPLANATIONS.player.parts.map((p) => (
                    <li key={p.label}>
                      <span className="text-slate-300">{p.label}</span> ({Math.round(p.weight * 100)}%) — {p.detail}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-slate-300 font-medium">{GRADE_EXPLANATIONS.opportunity.title}</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  {GRADE_EXPLANATIONS.opportunity.parts.map((p) => (
                    <li key={p.label}>
                      <span className="text-slate-300">{p.label}</span> ({Math.round(p.weight * 100)}%) — {p.detail}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-slate-300 font-medium">{GRADE_EXPLANATIONS.team.title}</p>
                <p className="mt-1">{GRADE_EXPLANATIONS.team.short}</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  {Object.entries(TEAM_CONTEXT_BY_POSITION).map(([pos, desc]) => (
                    <li key={pos}><span className="text-slate-300">{pos}</span> — {desc}</li>
                  ))}
                </ul>
              </div>
              <p className="text-amber-300/70">{ROOKIE_NOTE}</p>
              <p className="text-slate-500">{DEF_NOTE}</p>
            </div>
          </details>

          {/* Recency weights */}
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500 mb-3">Season Recency</p>
            <SplitBar
              segments={recencySegments}
              values={recencyValues}
              onChange={onRecencyChange}
              onCommit={onRecencyCommit}
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-700/50 shrink-0">
          <button
            onClick={handleReset}
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
