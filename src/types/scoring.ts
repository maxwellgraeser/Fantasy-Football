import type { NFLTeam, FantasyPosition, SleeperPlayerStats } from './sleeper'

// ─── Score Breakdown Components ─────────────────────────────────────────────

export interface PlayerGradeBreakdown {
  ppgPercentile: number       // raw percentile 0–100
  recentPpg: number           // weighted 3yr avg PPG
  ageCurveAdj: number         // positive or negative points
  durabilityPct: number       // % games played, 0–100
  efficiencyPct: number       // yd/touch or similar, 0–100
}

export interface OpportunityGradeBreakdown {
  depthChartScore: number     // 0–100, starter = high
  targetSharePct: number      // 0–100
  touchSharePct: number       // 0–100
  roleSteadiness: number      // consistency of role, 0–100
}

export interface TeamGradeBreakdown {
  // Common
  overallGrade: number        // final 0–100
  position: FantasyPosition
  team: NFLTeam | null
  // RB-specific
  rushAttPerGame?: number
  rushYdPerGame?: number
  rzRushSharePct?: number
  goalLineRushPct?: number
  rushYpc?: number
  // WR/TE-specific
  passAttPerGame?: number
  passYdPerGame?: number
  rzTargetSharePct?: number
  airYdPerGame?: number
  neutralPassRate?: number
  // QB-specific
  totalPlaysPerGame?: number
  passTdRate?: number
  rzTdRate?: number
  sackRateInv?: number        // 1 - sack_rate, normalized
}

export interface ValueScoreBreakdown {
  valueScore: number          // 0–100 composite
  playerGrade: number         // 0–100
  opportunityGrade: number    // 0–100
  teamGrade: number           // 0–100
  playerBreakdown: PlayerGradeBreakdown
  opportunityBreakdown: OpportunityGradeBreakdown
  teamBreakdown: TeamGradeBreakdown
  isRookie: boolean
  isProvisional: boolean      // rookie flag
}

// ─── Scoring Weights ─────────────────────────────────────────────────────────

export interface ScoringWeights {
  wPlayer: number             // default 0.55
  wOpportunity: number        // default 0.20
  wTeam: number               // default 0.25
  // Player history recency weights (must sum to 1)
  recencyY1: number           // most recent season, default 0.50
  recencyY2: number           // default 0.30
  recencyY3: number           // default 0.20
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  wPlayer: 0.55,
  wOpportunity: 0.20,
  wTeam: 0.25,
  recencyY1: 0.50,
  recencyY2: 0.30,
  recencyY3: 0.20,
}

// ─── Computed Player Row (used in the table) ─────────────────────────────────

export interface PlayerRow {
  playerId: string
  fullName: string
  position: FantasyPosition
  team: NFLTeam | null
  age: number | null
  yearsExp: number
  injuryStatus: string | null
  depthChartOrder: number | null
  // Per-season PPG history (most-recent first)
  ppgHistory: Array<{ season: string; ppg: number; gp: number; raw?: SleeperPlayerStats }>
  // Computed scores
  scores: ValueScoreBreakdown
  // Sparkline data
  sparkline: number[]
}
