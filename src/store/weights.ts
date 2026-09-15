import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_WEIGHTS, type ScoringWeights } from '@/types/scoring'

interface WeightsState {
  weights: ScoringWeights
  setWeights: (w: Partial<ScoringWeights>) => void
  reset: () => void
}

export const useWeightsStore = create<WeightsState>()(
  persist(
    (set) => ({
      weights: { ...DEFAULT_WEIGHTS },
      setWeights: (w) =>
        set((state) => ({
          weights: { ...state.weights, ...w },
        })),
      reset: () => set({ weights: { ...DEFAULT_WEIGHTS } }),
    }),
    { name: 'ff-scoring-weights' },
  ),
)
