import type { NFLTeam, FantasyPosition, SleeperPlayerStats } from './sleeper'

// ─── Scoring format ──────────────────────────────────────────────────────────

export type ScoringFormat = 'half_ppr' | 'ppr' | 'std'

// ─── Score Breakdown Components ─────────────────────────────────────────────

export interface PlayerGradeBreakdown {
  ppgPercentile: number       // recency-weighted PPG percentile vs position peers, 0–100
  recentPpg: number           // recency-weighted PPG
  ageCurveAdj: number         // points added/removed for age (≤ 0)
  ageAdjustedPct: number      // ppgPercentile + ageCurveAdj, clamped 0–100 ("Age-adjusted production")
  durabilityPct: number       // % of team games played, 0–100
  // Normalized sub-weights actually applied (sum to 1), for display
  ppgWeight: number
  ageWeight: number
  durabilityWeight: number
}

export interface OpportunityGradeBreakdown {
  depthChartScore: number     // 0–100, starter = high
  targetSharePct: number      // target volume percentile, 0–100
  touchSharePct: number       // touch volume percentile, 0–100
  roleSteadiness: number      // games-played percentile, 0–100
  // Normalized sub-weights actually applied (sum to 1), for display
  depthChartWeight: number
  targetShareWeight: number
  touchShareWeight: number
  roleSteadinessWeight: number
}

/** One team-context input, e.g. "Pass Att/G". */
export interface TeamMetric {
  key: string
  label: string               // e.g. "Pass Att/G"
  value: number               // raw value
  display: string             // formatted raw value, e.g. "36.2" or "58%"
  percentile: number          // league percentile among the 32 teams, 0–100
  weight: number              // share of the team grade, 0–1
}

export interface TeamGradeBreakdown {
  overallGrade: number        // final 0–100
  position: FantasyPosition
  team: NFLTeam | null
  metrics: TeamMetric[]
}

export type GradeKey = 'player' | 'opportunity' | 'team'

export interface GradeWeights {
  player: number
  opportunity: number
  team: number
}

/** One line of the worked Value math: grade × weight = points. */
export interface ValueContribution {
  key: GradeKey
  label: string               // "Player" | "Opportunity" | "Team"
  grade: number | null        // null = not applicable (e.g. DEF opportunity/team)
  weight: number              // applied (normalized) weight, 0–1
  points: number              // grade × weight (0 when not applicable)
}

export interface ValueScoreBreakdown {
  valueScore: number          // 0–100 composite
  playerGrade: number         // 0–100
  opportunityGrade: number | null   // null for DEF (n/a)
  teamGrade: number | null          // null for DEF (n/a)
  appliedWeights: GradeWeights      // normalized weights actually used (sum to 1)
  contributions: ValueContribution[]
  rookieMultiplier: number    // 0.85 for provisional rookies, else 1
  playerBreakdown: PlayerGradeBreakdown
  opportunityBreakdown: OpportunityGradeBreakdown | null
  teamBreakdown: TeamGradeBreakdown | null
  isRookie: boolean
  isProvisional: boolean      // rookie flag
}

// ─── Scoring Weights ─────────────────────────────────────────────────────────

export interface ScoringWeights {
  wPlayer: number             // default 0.55
  wOpportunity: number        // default 0.20
  wTeam: number               // default 0.25
  // Player history recency weights (normalized before use)
  recencyY1: number           // selected season, default 0.50
  recencyY2: number           // default 0.30
  recencyY3: number           // default 0.20
  // Player Grade sub-weights (normalized before use)
  playerWPpg: number          // PPG percentile, default 0.55
  playerWAge: number          // age-adjusted production, default 0.20
  playerWDurability: number   // durability, default 0.25
  // Opportunity Grade sub-weights (normalized before use)
  oppWDepthChart: number      // depth chart, default 0.35
  oppWTargetShare: number     // target volume, default 0.25
  oppWTouchShare: number      // touch volume, default 0.25
  oppWRoleSteadiness: number  // games played, default 0.15
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  wPlayer: 0.55,
  wOpportunity: 0.20,
  wTeam: 0.25,
  recencyY1: 0.50,
  recencyY2: 0.30,
  recencyY3: 0.20,
  playerWPpg: 0.55,
  playerWAge: 0.20,
  playerWDurability: 0.25,
  oppWDepthChart: 0.35,
  oppWTargetShare: 0.25,
  oppWTouchShare: 0.25,
  oppWRoleSteadiness: 0.15,
}

// ─── Computed Player Row (used in the tables) ────────────────────────────────

export interface SeasonLine {
  season: string
  ppg: number                 // fantasy PPG in the selected scoring format
  gp: number
  inProgress: boolean         // season still under way
  raw?: SleeperPlayerStats
}

export interface PlayerRow {
  playerId: string
  fullName: string
  position: FantasyPosition
  team: NFLTeam | null
  age: number | null
  yearsExp: number
  injuryStatus: string | null
  depthChartOrder: number | null
  college: string | null
  height: string | null       // formatted, e.g. 6'0"
  weight: string | null       // lbs
  searchRank: number | null   // Sleeper rank (null when unranked)
  rookieYear: string | null   // Sleeper metadata.rookie_year
  seasonPpg: number | null    // PPG in the selected season; null when no games played
  seasonGp: number            // games played in the selected season
  // Per-season history, most-recent first. Index 0 is always the selected season;
  // older entries only include seasons with games played.
  ppgHistory: SeasonLine[]
  // Sparkline: oldest → newest, last ≤ 5 seasons with games played
  sparkline: SeasonLine[]
  scores: ValueScoreBreakdown
}
