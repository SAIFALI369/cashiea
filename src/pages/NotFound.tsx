import { Link } from 'react-router-dom'
import { Home, ArrowLeft, Search, Compass } from 'lucide-react'

/**
 * NotFound (404) — navigation recovery with a little delight.
 * A quiet compass motif over the big numeral; every route out of the
 * dead end is one tap away.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient drift — two soft accent glows */}
      <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-accent/10 blur-3xl animate-drift" aria-hidden="true" />
      <div className="absolute -bottom-32 -right-32 w-[24rem] h-[24rem] rounded-full bg-gold/10 blur-3xl animate-drift" style={{ animationDelay: '-7s' }} aria-hidden="true" />

      <div className="relative max-w-md w-full text-center">
        {/* Big 404 with compass */}
        <div className="relative mb-8 select-none">
          <span className="text-[120px] sm:text-[140px] font-black leading-none bg-gradient-to-br from-accent to-gold bg-clip-text text-transparent">404</span>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full glass flex items-center justify-center shadow-float">
              <Compass className="w-8 h-8 text-accent-strong" strokeWidth={1.6} />
            </span>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-fg mb-2">This page wandered off</h1>
        <p className="text-sm text-fg-muted mb-8 leading-relaxed">
          The page you're looking for doesn't exist or was moved.
          <br />
          Let's get you back to business.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
          <Link
            to="/app"
            className="btn-primary w-full h-11 text-sm font-semibold"
          >
            <Home className="w-4 h-4" /> Go to dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn-secondary w-full h-11 text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Go back
          </button>
        </div>

        {/* Quick links */}
        <div className="mt-9 pt-6 border-t border-line">
          <p className="section-title mb-3.5 flex items-center justify-center gap-1.5">
            <Search className="w-3 h-3" /> Quick links
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {[
              { to: '/app/pos', label: 'New Sale' },
              { to: '/app/products', label: 'Stock' },
              { to: '/app/customers', label: 'Customers' },
              { to: '/app/invoices', label: 'Bills' },
              { to: '/app/assistant', label: 'Meraj' },
            ].map((link) => (
              <Link key={link.to} to={link.to} className="chip">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
