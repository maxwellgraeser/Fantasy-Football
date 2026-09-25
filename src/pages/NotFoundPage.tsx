import { Link, useLocation } from 'react-router-dom'

export function NotFoundPage() {
  const { pathname } = useLocation()

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 text-center">
      <p className="text-slate-400">Page not found.</p>
      <p className="text-slate-600 text-xs mt-1 break-all">{pathname}</p>
      <Link to="/players" className="inline-block mt-4 text-violet-400 text-sm hover:underline">
        ← Back to players
      </Link>
    </div>
  )
}
