import { Link } from 'react-router-dom'
import { Home, ArrowLeft, Search } from 'lucide-react'

/**
 * NotFound (404) — shown when a user hits an unknown route.
 * Provides navigation recovery instead of silently redirecting.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        {/* Big 404 */}
        <div className="relative mb-8">
          <span className="text-[120px] font-black text-accent-soft leading-none select-none">404</span>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="w-16 h-16 text-accent opacity-60" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-fg mb-2">Page not found</h1>
        <p className="text-sm text-fg-muted mb-8">
          The page you're looking for doesn't exist or was moved.
          <br />
          Let's get you back on track.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link
            to="/app"
            className="btn-primary w-full h-11 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Go to dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn-secondary w-full h-11 text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
        </div>

        {/* Quick links */}
        <div className="mt-8 pt-6 border-t border-line">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-3">
            Quick links
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { to: '/app/pos', label: 'New Sale' },
              { to: '/app/products', label: 'Stock' },
              { to: '/app/customers', label: 'Customers' },
              { to: '/app/invoices', label: 'Bills' },
              { to: '/app/assistant', label: 'Meraj' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-xs font-semibold text-accent bg-accent-soft rounded-full px-3 py-1.5 hover:bg-accent-soft/70 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
