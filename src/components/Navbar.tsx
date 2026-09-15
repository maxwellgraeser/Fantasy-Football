import { NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { usePlayers } from '@/hooks/usePlayers'
import { playerImageUrl } from '@/lib/sleeper'
import type { FantasyPosition } from '@/types/sleeper'

const tabs = [
  { path: '/players', label: 'Players' },
  { path: '/rookies', label: 'Rookies' },
  { path: '/watchlist', label: 'Watchlist' },
]

const SKILL_POSITIONS: FantasyPosition[] = ['QB', 'RB', 'WR', 'TE']

export function Navbar() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const { data: players } = usePlayers()
  const navigate = useNavigate()

  const results = query.length >= 2 && players
    ? Object.values(players)
        .filter((p) =>
          SKILL_POSITIONS.includes((p.fantasy_positions?.[0] ?? '') as FantasyPosition)
          && (p.full_name ?? `${p.first_name} ${p.last_name}`)
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .slice(0, 8)
    : []

  return (
    <nav className="sticky top-0 z-30 bg-[#0f1117]/95 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-violet-400 text-lg">🏈</span>
          <span className="font-bold text-sm text-white tracking-tight">GridironIQ</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1">
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-56">
          <input
            type="text"
            placeholder="Search players…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            className="w-full bg-slate-800/60 border border-slate-700 rounded-lg
              px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500
              focus:outline-none focus:border-violet-500 transition-colors"
          />

          {focused && results.length > 0 && (
            <div className="absolute top-full mt-1 right-0 w-72 bg-[#1a1d27] border border-slate-700 rounded-lg shadow-xl overflow-hidden">
              {results.map((p) => {
                const name = p.full_name ?? `${p.first_name} ${p.last_name}`
                const pos = p.fantasy_positions?.[0] ?? ''
                return (
                  <button
                    key={p.player_id}
                    onMouseDown={() => {
                      navigate(`/player/${p.player_id}`)
                      setQuery('')
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2
                      hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <img
                      src={playerImageUrl(p.player_id)}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover bg-slate-700"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">{name}</div>
                      <div className="text-xs text-slate-500">{pos} · {p.team ?? 'FA'}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
