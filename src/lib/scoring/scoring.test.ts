import { describe, expect, it } from 'vitest'
import { DEFAULT_WEIGHTS, type ScoringWeights } from '@/types/scoring'
import { percentileRank, clamp, weightedMean, zToGrade } from './normalize'
import { computeValue, normalizeGradeWeights, normalizeRecency, ROOKIE_MULTIPLIER } from './value'
import { computePpg, computePlayerGrade, durabilityScore } from './playerGrade'
import { computeOpportunityGrade } from './opportunityGrade'
import { computeAllTeamGrades, extractTeamRaws, seasonGamesPlayed } from './teamGrade'
import { applyWeights, buildGradedRows, buildPlayerRows, isRookieFor } from './composite'
import { isEligiblePlayer } from './eligibility'
import { makePlayer, makeTeamStats, season } from './testFixtures'

describe('normalize', () => {
  it('percentileRank counts ties as half', () => {
    expect(percentileRank(5, [1, 5, 9])).toBe(50)
    expect(percentileRank(10, [1, 5, 9])).toBe(100)
    expect(percentileRank(0, [1, 5, 9])).toBe(0)
    expect(percentileRank(3, [])).toBe(50)
  })

  it('clamp, weightedMean, zToGrade', () => {
    expect(clamp(120)).toBe(100)
    expect(clamp(-3)).toBe(0)
    expect(weightedMean([{ value: 10, weight: 0 }])).toBe(0)
    expect(weightedMean([{ value: 10, weight: 1 }, { value: 20, weight: 3 }])).toBe(17.5)
    expect(zToGrade(0)).toBe(50)
    expect(zToGrade(2)).toBe(73)
    expect(zToGrade(-2)).toBe(27)
    expect(zToGrade(10)).toBeLessThanOrEqual(75)
  })
})

describe('value', () => {
  const grades = { playerGrade: 80, opportunityGrade: 60, teamGrade: 40, isRookie: false }

  it('normalizes grade weights that do not sum to 1', () => {
    const w = normalizeGradeWeights({ wPlayer: 0.5, wOpportunity: 0, wTeam: 0 })
    expect(w).toEqual({ player: 1, opportunity: 0, team: 0 })
    // Previously this case halved every Value score
    expect(computeValue(grades, { ...DEFAULT_WEIGHTS, wPlayer: 0.5, wOpportunity: 0, wTeam: 0 }).valueScore).toBe(80)
  })

  it('falls back to defaults when all weights are zero', () => {
    expect(normalizeGradeWeights({ wPlayer: 0, wOpportunity: 0, wTeam: 0 })).toEqual(normalizeGradeWeights(DEFAULT_WEIGHTS))
    const r = normalizeRecency({ recencyY1: 0, recencyY2: 0, recencyY3: 0 })
    expect(r[0] + r[1] + r[2]).toBeCloseTo(1)
  })

  it('produces contributions that add up to the Value score', () => {
    const v = computeValue(grades, DEFAULT_WEIGHTS)
    const sum = v.contributions.reduce((s, c) => s + c.points, 0)
    expect(v.valueScore).toBe(Math.round(sum))
    expect(v.valueScore).toBe(Math.round(80 * 0.55 + 60 * 0.2 + 40 * 0.25))
  })

  it('drops n/a grades and renormalizes', () => {
    const v = computeValue({ playerGrade: 70, opportunityGrade: null, teamGrade: null, isRookie: false }, DEFAULT_WEIGHTS)
    expect(v.appliedWeights).toEqual({ player: 1, opportunity: 0, team: 0 })
    expect(v.valueScore).toBe(70)
    // Even when the user zeroes the player weight
    const zeroed = computeValue({ playerGrade: 70, opportunityGrade: null, teamGrade: null, isRookie: false },
      { ...DEFAULT_WEIGHTS, wPlayer: 0 })
    expect(zeroed.valueScore).toBe(70)
  })

  it('applies the rookie multiplier', () => {
    const v = computeValue({ ...grades, isRookie: true }, DEFAULT_WEIGHTS)
    expect(v.rookieMultiplier).toBe(ROOKIE_MULTIPLIER)
    expect(v.valueScore).toBe(Math.round((80 * 0.55 + 60 * 0.2 + 40 * 0.25) * ROOKIE_MULTIPLIER))
  })
})

describe('playerGrade', () => {
  it('computePpg respects scoring format', () => {
    const stats = { gp: 10, pts_half_ppr: 150, pts_ppr: 200, pts_std: 100 }
    expect(computePpg(stats)).toBe(15)
    expect(computePpg(stats, 'ppr')).toBe(20)
    expect(computePpg(stats, 'std')).toBe(10)
    expect(computePpg(undefined)).toBe(0)
  })

  it('durability uses games played to date for partial seasons', () => {
    const records = [{ season: '2026', stats: { gp: 1 } }]
    expect(durabilityScore(records, { '2026': 1 })).toBe(100)
    // Without the season-games map a Week 1 starter looked fragile
    expect(durabilityScore(records)).toBeCloseTo(100 / 17)
    expect(durabilityScore([{ season: '2025', stats: { gp: 17 } }, { season: '2024', stats: { gp: 8.5 } }], { '2025': 17, '2024': 17 })).toBe(75)
  })

  it('penalizes age past the position peak', () => {
    const opts = { recency: [1, 0, 0] as [number, number, number], format: 'half_ppr' as const, seasonGames: { '2025': 17 } }
    const records = [{ season: '2025', stats: { gp: 17, pts_half_ppr: 255 } }]
    const peers = [5, 10, 15, 20]
    const young = computePlayerGrade(makePlayer('a', { age: 26 }), records, peers, opts)
    const old = computePlayerGrade(makePlayer('b', { age: 34 }), records, peers, opts)
    expect(old.breakdown.ageAdjustedPct).toBeLessThan(young.breakdown.ageAdjustedPct)
    expect(old.grade).toBeLessThan(young.grade)
  })

  it('DEF grade is the PPG percentile', () => {
    const def = makePlayer('KC', { fantasy_positions: ['DEF'], position: 'DEF', age: null })
    const res = computePlayerGrade(def, [{ season: '2025', stats: { gp: 17, pts_half_ppr: 170 } }], [5, 8, 12],
      { recency: [1, 0, 0], format: 'half_ppr', seasonGames: {} })
    expect(res.grade).toBe(res.breakdown.ppgPercentile)
  })
})

describe('opportunityGrade', () => {
  it('ranks a starter with volume above a backup', () => {
    const field = [{ rec_tgt: 20, rec: 12, gp: 10 }, { rec_tgt: 80, rec: 50, gp: 17 }, { rec_tgt: 140, rec: 100, gp: 17 }]
    const starter = computeOpportunityGrade(makePlayer('s', { depth_chart_order: 1 }), field[2], field)
    const backup = computeOpportunityGrade(makePlayer('b', { depth_chart_order: 2 }), field[0], field)
    expect(starter.grade).toBeGreaterThan(backup.grade)
    expect(starter.breakdown.depthChartScore).toBe(90)
  })
})

describe('teamGrade', () => {
  const stats = season([
    makeTeamStats('KC', { pass_att: 650, pass_sack: 20 }),
    makeTeamStats('BUF', { pass_att: 500, pass_sack: 60 }),
    makeTeamStats('DET', { gp: 0 }),
  ])

  it('skips teams that have not played and reports games to date', () => {
    expect(extractTeamRaws(stats).has('DET')).toBe(false)
    expect(seasonGamesPlayed(stats)).toBe(17)
    expect(seasonGamesPlayed(season([makeTeamStats('KC', { gp: 1 })]))).toBe(1)
  })

  it('grades pass volume higher for WRs and treats sack rate as lower-is-better', () => {
    const grades = computeAllTeamGrades(stats)
    const kcWr = grades.get('KC')!.get('WR')!
    const bufWr = grades.get('BUF')!.get('WR')!
    expect(kcWr.overallGrade).toBeGreaterThan(bufWr.overallGrade)
    const kcSack = grades.get('KC')!.get('QB')!.metrics.find((m) => m.key === 'sackRate')!
    const bufSack = grades.get('BUF')!.get('QB')!.metrics.find((m) => m.key === 'sackRate')!
    expect(kcSack.percentile).toBeGreaterThan(bufSack.percentile)
    expect(kcSack.display).toMatch(/%$/)
    for (const m of kcWr.metrics) {
      expect(m.percentile).toBeGreaterThanOrEqual(0)
      expect(m.percentile).toBeLessThanOrEqual(100)
    }
  })
})

describe('composite', () => {
  const teams = [makeTeamStats('KC'), makeTeamStats('BUF', { pass_att: 520 })]

  function fixture() {
    const players = {
      star: makePlayer('star'),
      depth: makePlayer('depth', { team: 'BUF', depth_chart_order: 3 }),
      retired: makePlayer('retired', { team: null, metadata: { rookie_year: '2005' }, years_exp: 17 }),
      freeAgent: makePlayer('freeAgent', { team: null }),
      rookie: makePlayer('rookie', { metadata: { rookie_year: '2026' }, years_exp: 0 }),
      secondYear: makePlayer('secondYear', { metadata: { rookie_year: '2025' }, years_exp: 1 }),
      kicker: makePlayer('kicker', { fantasy_positions: ['K'], position: 'K' }),
      KC: makePlayer('KC', { fantasy_positions: ['DEF'], position: 'DEF', full_name: null, first_name: 'Kansas City', last_name: 'Chiefs', age: null, metadata: null }),
    }
    const s2026 = season([...teams.map(([k, v]) => [k, { ...v, gp: 1 }] as [string, typeof v]),
      ['star', { gp: 1, pts_half_ppr: 20, rec_tgt: 10, rec: 7 }],
      ['rookie', { gp: 1, pts_half_ppr: 8, rec_tgt: 5, rec: 3 }],
      ['KC', { gp: 1, pts_half_ppr: 9 }],
    ])
    const s2025 = season([...teams,
      ['star', { gp: 17, pts_half_ppr: 300, rec_tgt: 150, rec: 100 }],
      ['depth', { gp: 12, pts_half_ppr: 60, rec_tgt: 30, rec: 20 }],
      ['freeAgent', { gp: 10, pts_half_ppr: 50, rec_tgt: 25, rec: 15 }],
      ['secondYear', { gp: 16, pts_half_ppr: 150, rec_tgt: 90, rec: 60 }],
      ['KC', { gp: 17, pts_half_ppr: 120 }],
    ])
    const older = ['2024', '2023', '2022', '2021'].map((s) => ({
      season: s,
      stats: season([...teams, ['star', { gp: 16, pts_half_ppr: 240 }], ['KC', { gp: 17, pts_half_ppr: 110 }]]),
    }))
    return { players, s2026, s2025, older }
  }

  it('eligibility: keeps players on a team or with recent games, drops retired and non-scored positions', () => {
    const { players, s2025 } = fixture()
    expect(isEligiblePlayer(players.retired, s2025, undefined)).toBe(false)
    expect(isEligiblePlayer(players.freeAgent, s2025, undefined)).toBe(true)
    expect(isEligiblePlayer(players.freeAgent, {}, {})).toBe(false)
    expect(isEligiblePlayer(players.kicker, s2025, undefined)).toBe(false)

    const rows = buildPlayerRows(players, [{ season: '2025', stats: s2025 }, ...fixture().older])
    const ids = rows.map((r) => r.playerId)
    expect(ids).not.toContain('retired')
    expect(ids).not.toContain('kicker')
    expect(ids).toContain('freeAgent')
  })

  it('flags rookies relative to the selected season', () => {
    const { players } = fixture()
    expect(isRookieFor(players.rookie, '2026', '2026')).toBe(true)
    expect(isRookieFor(players.secondYear, '2026', '2026')).toBe(false)
    expect(isRookieFor(players.secondYear, '2025', '2026')).toBe(true)
    expect(isRookieFor(players.KC, '2026', '2026')).toBe(false)
    // years_exp fallback when rookie_year is missing
    expect(isRookieFor(makePlayer('x', { metadata: null, years_exp: 0 }), '2026', '2026')).toBe(true)
    expect(isRookieFor(makePlayer('y', { metadata: null, years_exp: 1 }), '2026', '2026')).toBe(false)
  })

  it('scores DEF on Player grade only', () => {
    const { players, s2025, older } = fixture()
    const rows = buildPlayerRows(players, [{ season: '2025', stats: s2025 }, ...older])
    const def = rows.find((r) => r.playerId === 'KC')!
    expect(def.fullName).toBe('Kansas City Chiefs')
    expect(def.scores.opportunityGrade).toBeNull()
    expect(def.scores.teamGrade).toBeNull()
    expect(def.scores.valueScore).toBe(def.scores.playerGrade)
  })

  it('in-progress season: durability is not penalized and the season is flagged', () => {
    const { players, s2026, s2025, older } = fixture()
    const rows = buildPlayerRows(players, [{ season: '2026', stats: s2026 }, { season: '2025', stats: s2025 }, ...older.slice(0, 3)],
      DEFAULT_WEIGHTS, { inProgressSeason: '2026', latestSeason: '2026' })
    const star = rows.find((r) => r.playerId === 'star')!
    expect(star.scores.playerBreakdown.durabilityPct).toBeGreaterThan(95)
    expect(star.seasonGp).toBe(1)
    expect(star.seasonPpg).toBe(20)
    expect(star.ppgHistory[0]).toMatchObject({ season: '2026', inProgress: true })
    expect(star.sparkline.at(-1)).toMatchObject({ season: '2026', inProgress: true })
    expect(rows.find((r) => r.playerId === 'rookie')!.scores.isRookie).toBe(true)
  })

  it('sparkline: oldest → newest, at most 5 seasons played', () => {
    const { players, s2026, s2025, older } = fixture()
    const list = [{ season: '2026', stats: s2026 }, { season: '2025', stats: s2025 }, ...older]
    const star = buildPlayerRows(players, list).find((r) => r.playerId === 'star')!
    expect(star.sparkline.map((s) => s.season)).toEqual(['2022', '2023', '2024', '2025', '2026'])
  })

  it('applyWeights re-sorts without recomputing grades', () => {
    const { players, s2025, older } = fixture()
    const graded = buildGradedRows(players, [{ season: '2025', stats: s2025 }, ...older],
      { recency: DEFAULT_WEIGHTS, format: 'half_ppr', inProgressSeason: null, latestSeason: '2026' })
    const teamHeavy: ScoringWeights = { ...DEFAULT_WEIGHTS, wPlayer: 0, wOpportunity: 0, wTeam: 1 }
    const rows = applyWeights(graded, teamHeavy).filter((r) => r.position !== 'DEF')
    for (const r of rows) expect(r.scores.valueScore).toBe(Math.round((r.scores.teamGrade ?? 0) * r.scores.rookieMultiplier))
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].scores.valueScore).toBeGreaterThanOrEqual(rows[i].scores.valueScore)
    }
  })
})
