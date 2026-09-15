import type {
  FantasyPosition,
  SleeperPlayer,
  SleeperPlayersMap,
  SleeperPlayerStats,
  SleeperSeasonStats,
} from '@/types/sleeper'
import type {
  OpportunityGradeBreakdown,
  PlayerGradeBreakdown,
  PlayerRow,
  ScoringFormat,
  ScoringWeights,
  SeasonLine,
  TeamGradeBreakdown,
} from '@/types/scoring'
import { DEFAULT_WEIGHTS } from '@/types/scoring'
import { formatHeight, playerName, primaryPosition } from '@/lib/positions'
import { computePlayerGrade, computePpg, FULL_SEASON_GAMES, type SeasonRecord } from './playerGrade'
import { computeOpportunityGrade } from './opportunityGrade'
import { computeAllTeamGrades, seasonGamesPlayed } from './teamGrade'
import { computeValue, normalizeRecency } from './value'
import { isEligiblePlayer } from './eligibility'

const SEASONS_FOR_GRADE = 3
const SPARKLINE_SEASONS = 5
const UNRANKED = 9999999

export interface SeasonStatsEntry {
  season: string
  stats: SleeperSeasonStats
}

export interface GradeOptions {
  recency: Pick<ScoringWeights, 'recencyY1' | 'recencyY2' | 'recencyY3'>
  format: ScoringFormat
  /** Season still under way (flags SeasonLine.inProgress), or null. */
  inProgressSeason: string | null
  /** Newest league season — used for the years_exp rookie fallback. */
  latestSeason: string
}

export interface GradeResult {
  playerGrade: number
  opportunityGrade: number | null
  teamGrade: number | null
  playerBreakdown: PlayerGradeBreakdown
  opportunityBreakdown: OpportunityGradeBreakdown | null
  teamBreakdown: TeamGradeBreakdown | null
  isRookie: boolean
}

/** A row with grades computed but no weights applied yet. */
export type GradedRow = Omit<PlayerRow, 'scores'> & { grades: GradeResult }

/**
 * Provisional rookie for `season`: hasn't completed an NFL season before it.
 * Uses Sleeper's metadata.rookie_year, falling back to years_exp.
 */
export function isRookieFor(player: SleeperPlayer, season: string, latestSeason: string): boolean {
  if (primaryPosition(player) === 'DEF') return false
  const rookieYear = player.metadata?.rookie_year
  if (rookieYear) return Number(rookieYear) >= Number(season)
  if (player.years_exp == null) return false
  return player.years_exp <= Number(latestSeason) - Number(season)
}

function emptyPositionMap<T>(make: () => T): Record<FantasyPosition, T> {
  return {
    QB: make(), RB: make(), WR: make(), TE: make(), K: make(),
    DEF: make(), DL: make(), LB: make(), DB: make(), IDP_FLEX: make(),
  }
}

/**
 * Compute grades for every eligible player.
 * `seasonStatsList` is most-recent first; index 0 is the selected season.
 */
export function buildGradedRows(
  players: SleeperPlayersMap,
  seasonStatsList: SeasonStatsEntry[],
  opts: GradeOptions,
): GradedRow[] {
  if (seasonStatsList.length === 0) return []

  const [selected, previous] = seasonStatsList
  const { format } = opts
  const recency = normalizeRecency(opts.recency)

  const seasonGames: Record<string, number> = {}
  for (const { season, stats } of seasonStatsList) {
    seasonGames[season] = seasonGamesPlayed(stats) || FULL_SEASON_GAMES
  }

  // ── 1. Team grades for the selected season only ─────────────────────────
  const teamGrades = computeAllTeamGrades(selected.stats)

  // ── 2. Eligible players + peer PPGs per position ────────────────────────
  const eligible: Array<{ player: SleeperPlayer; pos: FantasyPosition }> = []
  const peerPpgs = emptyPositionMap<number[]>(() => [])

  for (const player of Object.values(players)) {
    const pos = primaryPosition(player)
    if (!pos || !player.player_id) continue
    if (!isEligiblePlayer(player, selected.stats, previous?.stats)) continue
    eligible.push({ player, pos })
    const ppg = computePpg(selected.stats[player.player_id], format)
    if (ppg > 0) peerPpgs[pos].push(ppg)
  }

  // ── 3. Position stat arrays for opportunity percentiles ─────────────────
  const positionStats = emptyPositionMap<SleeperPlayerStats[]>(() => [])
  for (const [pid, stats] of Object.entries(selected.stats)) {
    const player = players[pid]
    const pos = player ? primaryPosition(player) : null
    if (pos) positionStats[pos].push(stats)
  }

  // ── 4. Grade rows ───────────────────────────────────────────────────────
  return eligible.map(({ player, pos }) => {
    const allRecords: SeasonRecord[] = seasonStatsList.map(({ season, stats }) => ({
      season,
      stats: stats[player.player_id],
    }))
    const records = allRecords.slice(0, SEASONS_FOR_GRADE)

    const lines: SeasonLine[] = allRecords.map((r) => ({
      season: r.season,
      ppg: computePpg(r.stats, format),
      gp: r.stats?.gp ?? 0,
      inProgress: r.season === opts.inProgressSeason,
      raw: r.stats,
    }))
    const ppgHistory = lines.filter((h, i) => i === 0 || h.gp > 0)
    const sparkline = lines.filter((h) => h.gp > 0).slice(0, SPARKLINE_SEASONS).reverse()

    const { grade: playerGrade, breakdown: playerBreakdown } = computePlayerGrade(
      player,
      records,
      peerPpgs[pos],
      { recency, format, seasonGames },
    )

    let opportunityGrade: number | null = null
    let opportunityBreakdown: OpportunityGradeBreakdown | null = null
    let teamGrade: number | null = null
    let teamBreakdown: TeamGradeBreakdown | null = null

    // DEF is scored on Player grade only — opportunity/team don't apply.
    if (pos !== 'DEF') {
      const opp = computeOpportunityGrade(player, records[0]?.stats, positionStats[pos])
      opportunityGrade = opp.grade
      opportunityBreakdown = opp.breakdown

      const tg = player.team ? teamGrades.get(player.team)?.get(pos) : undefined
      teamGrade = tg?.overallGrade ?? 50
      teamBreakdown = tg ?? { overallGrade: 50, position: pos, team: player.team, metrics: [] }
    }

    const searchRank = player.search_rank != null && player.search_rank < UNRANKED ? player.search_rank : null

    return {
      playerId: player.player_id,
      fullName: playerName(player),
      position: pos,
      team: player.team ?? null,
      age: player.age ?? null,
      yearsExp: player.years_exp ?? 0,
      injuryStatus: player.injury_status ?? null,
      depthChartOrder: player.depth_chart_order ?? null,
      college: player.college ?? null,
      height: formatHeight(player.height),
      weight: player.weight ?? null,
      searchRank,
      rookieYear: player.metadata?.rookie_year ?? null,
      seasonPpg: lines[0].gp > 0 ? lines[0].ppg : null,
      seasonGp: lines[0].gp,
      ppgHistory,
      sparkline,
      grades: {
        playerGrade,
        opportunityGrade,
        teamGrade,
        playerBreakdown,
        opportunityBreakdown,
        teamBreakdown,
        isRookie: isRookieFor(player, selected.season, opts.latestSeason),
      },
    }
  })
}

/** Apply grade weights to graded rows → PlayerRows sorted by Value (desc). Cheap; safe per slider tick. */
export function applyWeights(graded: GradedRow[], weights: ScoringWeights): PlayerRow[] {
  const rows: PlayerRow[] = graded.map(({ grades, ...row }) => {
    const value = computeValue(grades, weights)
    return {
      ...row,
      scores: {
        valueScore: value.valueScore,
        playerGrade: grades.playerGrade,
        opportunityGrade: grades.opportunityGrade,
        teamGrade: grades.teamGrade,
        appliedWeights: value.appliedWeights,
        contributions: value.contributions,
        rookieMultiplier: value.rookieMultiplier,
        playerBreakdown: grades.playerBreakdown,
        opportunityBreakdown: grades.opportunityBreakdown,
        teamBreakdown: grades.teamBreakdown,
        isRookie: grades.isRookie,
        isProvisional: grades.isRookie,
      },
    }
  })

  return rows.sort((a, b) =>
    b.scores.valueScore - a.scores.valueScore
    || b.scores.playerGrade - a.scores.playerGrade
    || a.fullName.localeCompare(b.fullName),
  )
}

/** Convenience: grade + weight in one call. */
export function buildPlayerRows(
  players: SleeperPlayersMap,
  seasonStatsList: SeasonStatsEntry[],
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  opts: Partial<Omit<GradeOptions, 'recency'>> = {},
): PlayerRow[] {
  const latestSeason = opts.latestSeason ?? seasonStatsList[0]?.season ?? String(new Date().getFullYear())
  const graded = buildGradedRows(players, seasonStatsList, {
    recency: weights,
    format: opts.format ?? 'half_ppr',
    inProgressSeason: opts.inProgressSeason ?? null,
    latestSeason,
  })
  return applyWeights(graded, weights)
}
