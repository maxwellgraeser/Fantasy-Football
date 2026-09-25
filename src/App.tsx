import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import { ScoresProvider } from '@/components/ScoresProvider'

const PlayersPage = lazy(() => import('@/pages/PlayersPage').then((m) => ({ default: m.PlayersPage })))
const PlayerDetailPage = lazy(() => import('@/pages/PlayerDetailPage').then((m) => ({ default: m.PlayerDetailPage })))
const RookiesPage = lazy(() => import('@/pages/RookiesPage').then((m) => ({ default: m.RookiesPage })))
const TrendingPage = lazy(() => import('@/pages/TrendingPage').then((m) => ({ default: m.TrendingPage })))
const WatchlistPage = lazy(() => import('@/pages/WatchlistPage').then((m) => ({ default: m.WatchlistPage })))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

function PageFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-800/40 rounded animate-pulse" />
      ))}
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ScoresProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-[#0f1117]">
            <Navbar />
            <main>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<Navigate to="/players" replace />} />
                  <Route path="/players" element={<PlayersPage />} />
                  <Route path="/player/:id" element={<PlayerDetailPage />} />
                  <Route path="/trending" element={<TrendingPage />} />
                  <Route path="/rookies" element={<RookiesPage />} />
                  <Route path="/watchlist" element={<WatchlistPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </BrowserRouter>
      </ScoresProvider>
    </QueryClientProvider>
  )
}
