import { describe, expect, it } from 'vitest'
import type { NFLState } from '@/types/sleeper'
import { deriveSeasonInfo, selectSeason } from './season'

const state = (overrides: Partial<NFLState>): NFLState => ({
  week: 1,
  season_type: 'regular',
  season_start_date: '2026-09-09',
  season: '2026',
  previous_season: '2025',
  leg: 1,
  league_season: '2026',
  display_week: 1,
  ...overrides,
})

describe('season model', () => {
  it('regular season: last completed = previous season, current in progress', () => {
    const info = deriveSeasonInfo(state({ display_week: 3 }))
    expect(info).toEqual({ completedSeason: '2025', inProgressSeason: '2026', latestSeason: '2026', week: 3 })
  })

  it('postseason: the season is complete', () => {
    expect(deriveSeasonInfo(state({ season_type: 'post' }))).toMatchObject({ completedSeason: '2026', inProgressSeason: null })
  })

  it('offseason / preseason: nothing in progress', () => {
    expect(deriveSeasonInfo(state({ season_type: 'pre' }))).toMatchObject({ completedSeason: '2025', inProgressSeason: null, latestSeason: '2026' })
    expect(deriveSeasonInfo(state({ season_type: 'off' }))).toMatchObject({ completedSeason: '2025', inProgressSeason: null })
  })

  it('falls back to the calendar without NFL state', () => {
    expect(deriveSeasonInfo(null, new Date('2026-10-01'))).toMatchObject({ completedSeason: '2025', inProgressSeason: '2026' })
    expect(deriveSeasonInfo(null, new Date('2026-04-01'))).toMatchObject({ completedSeason: '2025', inProgressSeason: null })
  })

  it('selects seasons relative to the chosen mode', () => {
    const info = deriveSeasonInfo(state({}))
    expect(selectSeason(info, 'completed')).toEqual({
      mode: 'completed', selectedSeason: '2025', isInProgress: false,
      seasonsToLoad: ['2025', '2024', '2023', '2022', '2021'],
    })
    expect(selectSeason(info, 'current')).toMatchObject({ mode: 'current', selectedSeason: '2026', isInProgress: true })
  })

  it("falls back to 'completed' when no season is in progress", () => {
    const info = deriveSeasonInfo(state({ season_type: 'off' }))
    expect(selectSeason(info, 'current')).toMatchObject({ mode: 'completed', selectedSeason: '2025' })
  })
})
