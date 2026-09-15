import { get as idbGet, set as idbSet, clear as idbClear } from 'idb-keyval'

const TTL_PLAYERS_MS = 24 * 60 * 60 * 1000     // 24 hours
const TTL_STATS_MS   = 6 * 60 * 60 * 1000       // 6 hours

interface CacheEntry<T> {
  data: T
  cachedAt: number
}

async function getWithTTL<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const entry = await idbGet<CacheEntry<T>>(key)
    if (!entry) return null
    if (Date.now() - entry.cachedAt > ttlMs) return null
    return entry.data
  } catch {
    return null
  }
}

async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    await idbSet(key, { data, cachedAt: Date.now() } satisfies CacheEntry<T>)
  } catch {
    // IndexedDB may be unavailable in some environments — fail silently
  }
}

// Version bump: bump this when the data schema changes to force cache invalidation
const CACHE_VERSION = 'v3'

/** Call once on app startup to evict caches from old schema versions. */
export async function clearStaleCache(): Promise<void> {
  try {
    const versionKey = 'sleeper:cache-version'
    const stored = await idbGet<string>(versionKey)
    if (stored !== CACHE_VERSION) {
      await idbClear()
      await idbSet(versionKey, CACHE_VERSION)
    }
  } catch {
    // ignore
  }
}

// ─── Public helpers ──────────────────────────────────────────────────────────

export async function getCachedPlayers<T>(): Promise<T | null> {
  return getWithTTL<T>('sleeper:players', TTL_PLAYERS_MS)
}

export async function setCachedPlayers<T>(data: T): Promise<void> {
  return setCache('sleeper:players', data)
}

export async function getCachedStats<T>(season: string): Promise<T | null> {
  return getWithTTL<T>(`sleeper:stats:${season}`, TTL_STATS_MS)
}

export async function setCachedStats<T>(season: string, data: T): Promise<void> {
  return setCache(`sleeper:stats:${season}`, data)
}

export async function getCachedValue<T>(key: string, ttlMs = TTL_STATS_MS): Promise<T | null> {
  return getWithTTL<T>(key, ttlMs)
}

export async function setCachedValue<T>(key: string, data: T): Promise<void> {
  return setCache(key, data)
}
