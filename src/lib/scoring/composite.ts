import type { FantasyPosition, NFLTeam } from '@/types/sleeper'
import type { SleeperSeasonStats } from '@/types/sleeper'
import type {
  ValueScoreBreakdown,
  ScoringWeights,
  TeamGradeBreakdown,
  PlayerRow,
} from '@/types/scoring'
import { clamp } from './normalize'
import { computePlayerGrade, computePpg, type SeasonRecord } from './playerGrade'
import { computeOpportunityGrade } from './opportunityGrade'
import { computeAllTeamGrades } from './teamGrade'
import type { SleeperPlayersMap } from '@/types/sleeper'

const SKILL_POSITIONS: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE', 'DEF']
const SEASONS_NEEDED = 3

/**
 * Build all PlayerRows for the table.
 * seasonStatsList: array of { season, stats } most-recent first.
 */
export function buildPlayerRows(
  players: SleeperPlayersMap,
  seasonStatsList: Array<{ season: string; stats: SleeperSeasonStats }>,
  weights: ScoringWeights,
): PlayerRow[] {
  if (seasonStatsList.length === 0) return []

  // ── 1. Build team grade maps per season, then blend ─────────────────────
  const teamGradeMaps = seasonStatsList.map(({ stats }) =>
    computeAllTeamGrades(stats),
  )

  // Use the most-recent season's team grades as the primary
  const primaryTeamGrades = teamGradeMaps[0]

  // ── 2. Collect peer PPG arrays per position ──────────────────────────────
  const peerPpgs: Record<FantasyPosition, number[]> = {
    QB: [], RB: [], WR: [], TE: [], K: [], DEF: [], DL: [], LB: [], DB: [], IDP_FLEX: [],
  }

  const allPlayersList = Object.values(players).filter((p) => {
    if (!SKILL_POSITIONS.includes((p.fantasy_positions?.[0] ?? '') as FantasyPosition)) return false
    // Exclude retired/historical players — Inactive with no team and no recent NFL presence
    if (p.status === 'Inactive' && !p.team) return false
    return true
  })

  for (const player of allPlayersList) {
    const pos = (player.fantasy_positions?.[0] ?? '') as FantasyPosition
    const stats = seasonStatsList[0]?.stats?.[player.player_id]
    const ppg = computePpg(stats)
    if (ppg > 0) peerPpgs[pos].push(ppg)
  }

  // ── 3. Collect position stats arrays for opportunity grading ─────────────
  const positionStatsArrays: Record<FantasyPosition, ReturnType<typeof Object.values>> = {
    QB: [], RB: [], WR: [], TE: [], K: [], DEF: [], DL: [], LB: [], DB: [], IDP_FLEX: [],
  }

  for (const [pid, stats] of Object.entries(seasonStatsList[0]?.stats ?? {})) {
    const player = players[pid]
    if (!player) continue
    const pos = (player.fantasy_positions?.[0] ?? '') as FantasyPosition
    if (SKILL_POSITIONS.includes(pos)) {
      positionStatsArrays[pos].push(stats)
    }
  }

  // ── 4. Build rows ────────────────────────────────────────────────────────
  const rows: PlayerRow[] = []

  for (const player of allPlayersList) {
    if (!player.player_id) continue

    const pos = (player.fantasy_positions?.[0] ?? 'WR') as FantasyPosition
    if (!SKILL_POSITIONS.includes(pos)) continue

    // Collect per-season records (most-recent first) — all seasons for history, capped for grading
    const allRecords: SeasonRecord[] = seasonStatsList.map(({ season, stats }) => ({
      season,
      stats: stats[player.player_id],
    }))
    const records = allRecords.slice(0, SEASONS_NEEDED)

    const yearsExp = player.years_exp ?? 0

    // Skip: undrafted/unsigned (years_exp=0, no team, no production) — these are prospects, not active players
    const hasAnyProduction = allRecords.some((r) => r.stats && (r.stats.gp ?? 0) > 0)
    if (yearsExp === 0 && !player.team && !hasAnyProduction && pos !== 'DEF') continue
    // Skip: veteran with zero recorded NFL activity
    if (!hasAnyProduction && yearsExp > 2) continue

    // PPG history for sparkline — use full available history, trimmed to active seasons
    const ppgHistory = allRecords
      .map((r) => ({ season: r.season, ppg: computePpg(r.stats), gp: r.stats?.gp ?? 0, raw: r.stats }))
      .filter((h, i) => i === 0 || h.gp > 0)

    // PlayerGrade
    const { grade: playerGrade, breakdown: playerBreakdown } = computePlayerGrade(
      player,
      records,
      peerPpgs[pos],
      weights,
    )

    // OpportunityGrade
    const { grade: opportunityGrade, breakdown: opportunityBreakdown } = computeOpportunityGrade(
      player,
      records[0]?.stats,
      positionStatsArrays[pos] as import('@/types/sleeper').SleeperPlayerStats[],
    )

    // TeamGrade
    let teamGrade = 50
    let teamBreakdown: TeamGradeBreakdown = {
      overallGrade: 50,
      position: pos,
      team: player.team,
    }
    if (player.team) {
      const tg = primaryTeamGrades.get(player.team as NFLTeam)?.get(pos)
      if (tg) {
        teamGrade = tg.overallGrade
        teamBreakdown = tg
      }
    }

    // Composite ValueScore
    // years_exp=1 = first NFL season (2025 draft class). years_exp=0 = undrafted/unsigned prospect.
    const isRookie = yearsExp === 1 && pos !== 'DEF'
    const rookiePenalty = isRookie ? 0.85 : 1

    const valueScore = clamp(Math.round(
      (weights.wPlayer * playerGrade
       + weights.wOpportunity * opportunityGrade
       + weights.wTeam * teamGrade)
      * rookiePenalty,
    ))

    const scores: ValueScoreBreakdown = {
      valueScore,
      playerGrade,
      opportunityGrade,
      teamGrade,
      playerBreakdown,
      opportunityBreakdown,
      teamBreakdown,
      isRookie,
      isProvisional: isRookie,
    }

    rows.push({
      playerId: player.player_id,
      fullName: player.full_name ?? `${player.first_name} ${player.last_name}`,
      position: pos,
      team: player.team,
      age: player.age,
      yearsExp: player.years_exp ?? 0,
      injuryStatus: player.injury_status,
      depthChartOrder: player.depth_chart_order,
      ppgHistory,
      scores,
      sparkline: ppgHistory.map((h) => h.ppg).reverse(),
    })
  }

  // Sort by value score descending
  return rows.sort((a, b) => b.scores.valueScore - a.scores.valueScore)
}
