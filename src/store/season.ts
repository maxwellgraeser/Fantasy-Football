import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SeasonMode } from '@/lib/season'

interface SeasonState {
  /** User's choice: last completed season (default) or current season-to-date. */
  mode: SeasonMode
  setMode: (mode: SeasonMode) => void
}

export const useSeasonStore = create<SeasonState>()(
  persist(
    (set) => ({
      mode: 'completed',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'ff-season' },
  ),
)
