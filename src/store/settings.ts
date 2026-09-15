import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ScoringFormat } from '@/types/scoring'

interface SettingsState {
  scoringFormat: ScoringFormat
  setScoringFormat: (f: ScoringFormat) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      scoringFormat: 'half_ppr',
      setScoringFormat: (scoringFormat) => set({ scoringFormat }),
    }),
    { name: 'ff-settings' },
  ),
)
