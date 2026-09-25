import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { useValueScores } from '@/hooks/useValueScores'
import { positionBadgeClass } from '@/lib/positions'

const tabs = [
  { path: '/players', label: 'Players' },
  { path: '/trending', label: 'Trending' },
  { path: '/rookies', label: 'Rookies' },
  { path: '/watchlist', label: 'Watchlist' },
]

const SEARCH_DEBOUNCE_MS = 150
const MAX_RESULTS = 8

interface SearchEntry {
  id: string
  name: string
  words: string[]
  position: string
  team: string | null
  value: number
}

export function Navbar() {
  const { rows } = useValueScores()
  const navigate = useNavigate()
  const listboxId = useId()

  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [prevQuery, setPrevQuery] = useState(debouncedQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  // Pending "close results" timer from the last blur. Cleared on refocus so a quick
  // blur → focus (e.g. picking a result, then typing again) doesn't hide new results.
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(blurTimer.current), [])

  // Debounce the query so we don't re-scan the index on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  // Index built once from the shared, already-eligible (no retired players) row set.
  const searchIndex = useMemo<SearchEntry[]>(() => rows.map((r) => ({
    id: r.playerId,
    name: r.fullName,
    words: r.fullName.toLowerCase().split(/\s+/),
    position: r.position,
    team: r.team,
    value: r.scores.valueScore,
  })), [rows])

  const results = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (q.length < 2) return []
    // Rows arrive sorted by Value desc, so each bucket stays Value-ordered —
    // prefix matches (rank above) are simply concatenated ahead of substring matches.
    const prefix: SearchEntry[] = []
    const substring: SearchEntry[] = []
    for (const entry of searchIndex) {
      if (entry.words.some((w) => w.startsWith(q))) prefix.push(entry)
      else if (entry.name.toLowerCase().includes(q)) substring.push(entry)
    }
    return [...prefix, ...substring].slice(0, MAX_RESULTS)
  }, [searchIndex, debouncedQuery])

  // Reset the highlighted option whenever the result set changes, without an
  // effect-driven cascade (React's "adjust state during render" pattern).
  if (debouncedQuery !== prevQuery) {
    setPrevQuery(debouncedQuery)
    setActiveIndex(-1)
  }

  const showResults = focused && results.length > 0

  function openPlayer(id: string) {
    navigate(`/player/${id}`)
    closeSearch()
  }

  function closeSearch() {
    setQuery('')
    setDebouncedQuery('')
    setFocused(false)
    setActiveIndex(-1)
    setMobileSearchOpen(false)
    inputRef.current?.blur()
  }

  function openMobileSearch() {
    // Render the input synchronously so it can be focused inside the tap gesture
    // (mobile browsers only raise the keyboard for focus within a user gesture).
    flushSync(() => setMobileSearchOpen(true))
    inputRef.current?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeSearch()
      return
    }
    if (!showResults) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = results[activeIndex] ?? results[0]
      if (pick) openPlayer(pick.id)
    }
  }

  return (
    <nav className="sticky top-0 z-30 bg-[#0f1117]/95 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3 sm:gap-6">
        {/* Logo + tabs / mobile menu — hidden on mobile while search is expanded */}
        <div className={`${mobileSearchOpen ? 'hidden' : 'flex'} sm:flex items-center gap-3 sm:gap-6 min-w-0`}>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-violet-400 text-lg">🏈</span>
            <span className="font-bold text-sm text-white tracking-tight">Min Max Fantasy</span>
          </div>

          {/* Desktop tabs */}
          <div className="hidden sm:flex items-center gap-1">
            {tabs.map((t) => (
              <NavLink
                key={t.path}
                to={t.path}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors
                  ${isActive
                    ? 'text-white bg-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </div>

          {/* Mobile nav menu */}
          <div className="relative sm:hidden">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              aria-label="Open navigation menu"
              className="p-1.5 -ml-1.5 text-lg text-slate-300 hover:text-white rounded transition-colors"
            >
              ☰
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full mt-1 w-40 bg-[#1a1d27] border border-slate-700 rounded-lg shadow-xl overflow-hidden z-40">
                {tabs.map((t) => (
                  <NavLink
                    key={t.path}
                    to={t.path}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `block px-3 py-2 text-sm transition-colors
                      ${isActive ? 'text-white bg-slate-700/60' : 'text-slate-300 hover:bg-slate-800/60'}`
                    }
                  >
                    {t.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className={`flex-1 ${mobileSearchOpen ? 'hidden sm:block' : ''}`} />

        {/* Mobile search icon (collapsed state) */}
        <button
          onClick={openMobileSearch}
          aria-label="Search players"
          className={`${mobileSearchOpen ? 'hidden' : 'flex'} sm:hidden p-1.5 text-lg text-slate-300 hover:text-white rounded shrink-0 transition-colors`}
        >
          🔎
        </button>

        {/* Search — icon-expanded full width on mobile, fixed width on desktop */}
        <div className={`relative ${mobileSearchOpen ? 'flex' : 'hidden'} sm:flex items-center gap-2 flex-1 min-w-0 sm:flex-none sm:w-56`}>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showResults}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 && results[activeIndex] ? `${listboxId}-option-${results[activeIndex].id}` : undefined}
            placeholder="Search players…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              clearTimeout(blurTimer.current)
              setFocused(true)
            }}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setFocused(false), 150)
            }}
            onKeyDown={handleKeyDown}
            className="w-full min-w-0 bg-slate-800/60 border border-slate-700 rounded-lg
              px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500
              focus:outline-none focus:border-violet-500 transition-colors"
          />
          {mobileSearchOpen && (
            <button
              onClick={closeSearch}
              aria-label="Close search"
              className="sm:hidden text-slate-400 hover:text-slate-200 text-sm shrink-0"
            >
              ✕
            </button>
          )}

          {showResults && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute top-full mt-1 left-0 right-0 sm:left-auto sm:right-0 sm:w-72
                bg-[#1a1d27] border border-slate-700 rounded-lg shadow-xl overflow-hidden
                max-h-80 overflow-y-auto z-40"
            >
              {results.map((r, i) => (
                <li
                  key={r.id}
                  id={`${listboxId}-option-${r.id}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={() => openPlayer(r.id)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors
                    ${i === activeIndex ? 'bg-slate-700/50' : 'hover:bg-slate-700/50'}`}
                >
                  <span className={`text-[10px] font-semibold px-1 py-0.5 rounded shrink-0 ${positionBadgeClass(r.position)}`}>
                    {r.position}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.team ?? 'FA'}</div>
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">{r.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </nav>
  )
}
