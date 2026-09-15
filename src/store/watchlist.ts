import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WatchlistState {
  playerIds: string[]
  add: (id: string) => void
  remove: (id: string) => void
  toggle: (id: string) => void
  has: (id: string) => boolean
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      playerIds: [],
      add: (id) =>
        set((s) => ({ playerIds: s.playerIds.includes(id) ? s.playerIds : [...s.playerIds, id] })),
      remove: (id) => set((s) => ({ playerIds: s.playerIds.filter((p) => p !== id) })),
      toggle: (id) => {
        if (get().playerIds.includes(id)) get().remove(id)
        else get().add(id)
      },
      has: (id) => get().playerIds.includes(id),
    }),
    { name: 'ff-watchlist' },
  ),
)
