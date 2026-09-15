import type { NFLState } from '@/types/sleeper'

export type SeasonMode = 'completed' | 'current'

export const SEASONS_TO_LOAD = 5

export interface SeasonInfo {
  /** Last fully completed regular season, e.g. "2025". */
  completedSeason: string
  /** Season with regular-season games under way, or null (offseason / preseason / postseason). */
  inProgressSeason: string | null
  /** Newest league season — the current rookie class year. */
  latestSeason: string
  /** Current NFL week while a season is in progress. */
  week: number | null
}

export interface SelectedSeason {
  /** Effective mode — falls back to 'completed' when no season is in progress. */
  mode: SeasonMode
  selectedSeason: string
  isInProgress: boolean
  /** SEASONS_TO_LOAD seasons, most recent first, starting at selectedSeason. */
  seasonsToLoad: string[]
}

/** Derive season info from Sleeper's NFL state (or the calendar when unavailable). */
export function deriveSeasonInfo(state: NFLState | null | undefined, now = new Date()): SeasonInfo {
  if (!state) {
    const year = now.getFullYear()
    // Regular season runs roughly September → early January.
    const month = now.getMonth() // 0 = Jan
    if (month >= 8) {
      return { completedSeason: String(year - 1), inProgressSeason: String(year), latestSeason: String(year), week: null }
    }
    return { completedSeason: String(year - 1), inProgressSeason: null, latestSeason: String(year), week: null }
  }

  const latestSeason = state.season
  if (state.season_type === 'regular') {
    return {
      completedSeason: state.previous_season,
      inProgressSeason: state.season,
      latestSeason,
      week: state.display_week || state.week || null,
    }
  }
  if (state.season_type === 'post') {
    return { completedSeason: state.season, inProgressSeason: null, latestSeason, week: null }
  }
  // 'pre' / 'off': the new league season exists but no games have been played
  return { completedSeason: state.previous_season, inProgressSeason: null, latestSeason, week: null }
}

export function selectSeason(info: SeasonInfo, mode: SeasonMode): SelectedSeason {
  const effectiveMode: SeasonMode = mode === 'current' && info.inProgressSeason ? 'current' : 'completed'
  const selectedSeason = effectiveMode === 'current' ? info.inProgressSeason! : info.completedSeason
  const year = parseInt(selectedSeason, 10)
  return {
    mode: effectiveMode,
    selectedSeason,
    isInProgress: selectedSeason === info.inProgressSeason,
    seasonsToLoad: Array.from({ length: SEASONS_TO_LOAD }, (_, i) => String(year - i)),
  }
}
