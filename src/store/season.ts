import { create } from 'zustand'

interface SeasonState {
  currentSeason: string   // e.g. "2024"
  setCurrentSeason: (s: string) => void
  getSeasonsToLoad: () => string[]
}

export const useSeasonStore = create<SeasonState>()((set, get) => ({
  currentSeason: String(new Date().getFullYear()),
  setCurrentSeason: (s) => set({ currentSeason: s }),
  getSeasonsToLoad: () => {
    const year = parseInt(get().currentSeason)
    return Array.from({ length: 8 }, (_, i) => String(year - i))
  },
}))
