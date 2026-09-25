import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Optional build-time default, e.g. VITE_SLEEPER_USERNAME=yourname in .env.local */
const DEFAULT_USERNAME = (import.meta.env.VITE_SLEEPER_USERNAME as string | undefined)?.trim() || null

interface AccountState {
  /** Connected Sleeper username; null until the user connects (or disconnects). */
  username: string | null
  selectedLeagueId: string | null
  connect: (username: string) => void
  disconnect: () => void
  selectLeague: (leagueId: string) => void
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      username: DEFAULT_USERNAME,
      selectedLeagueId: null,
      connect: (username) => set({ username: username.trim(), selectedLeagueId: null }),
      disconnect: () => set({ username: null, selectedLeagueId: null }),
      selectLeague: (selectedLeagueId) => set({ selectedLeagueId }),
    }),
    { name: 'ff-account' },
  ),
)
