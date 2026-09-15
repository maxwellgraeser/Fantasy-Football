import { useMemo } from 'react'
import { useNFLState } from './useNFLState'
import { useSeasonStore } from '@/store/season'
import { deriveSeasonInfo, selectSeason, type SeasonInfo, type SeasonMode, type SelectedSeason } from '@/lib/season'

export interface SeasonContext extends SeasonInfo, SelectedSeason {
  /** False until Sleeper's NFL state has loaded (or failed → calendar fallback). */
  isReady: boolean
  setMode: (mode: SeasonMode) => void
}

export function useSeasonContext(): SeasonContext {
  const { data, isLoading } = useNFLState()
  const mode = useSeasonStore((s) => s.mode)
  const setMode = useSeasonStore((s) => s.setMode)

  return useMemo(() => {
    const info = deriveSeasonInfo(data)
    return { ...info, ...selectSeason(info, mode), isReady: !isLoading, setMode }
  }, [data, isLoading, mode, setMode])
}
