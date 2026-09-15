import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Navbar } from '@/components/Navbar'
import { PlayersPage } from '@/pages/PlayersPage'
import { PlayerDetailPage } from '@/pages/PlayerDetailPage'
import { RookiesPage } from '@/pages/RookiesPage'
import { WatchlistPage } from '@/pages/WatchlistPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-[#0f1117]">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Navigate to="/players" replace />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/player/:id" element={<PlayerDetailPage />} />
              <Route path="/rookies" element={<RookiesPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
