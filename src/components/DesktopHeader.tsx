import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LiveClock } from './LiveClock'
import { QueueBadge } from './QueueBadge'
import { Avatar } from './Avatar'
import { CashieaLogo } from './CashieaLogo'
import { Settings, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * DesktopHeader — sticky top bar shown ONLY on the desktop shell (≥lg).
 * Brand (left) · global search · sync queue · clock · account (right).
 * Designed so the layout feels purpose-built for desktop, not just a
 * stretched mobile view.
 */
export default function DesktopHeader() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="hidden lg:flex sticky top-0 z-30 bg-surface/85 backdrop-blur border-b border-line px-6 xl:px-10 h-16 items-center gap-4 shrink-0">
      <Link to="/app" className="flex items-center gap-2.5 group">
        <CashieaLogo size={34} />
        <div className="min-w-0">
          <h1 className="font-bold text-fg text-base leading-none">Cashiea</h1>
          <p className="text-[11px] text-fg-subtle mt-0.5 truncate max-w-[180px]">{profile?.company_name || 'Your business workspace'}</p>
        </div>
      </Link>

      {/* Global search bar (Ctrl+K eventually wired) */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('cashiea:command-palette'))}
        className="flex-1 max-w-xl mx-4 flex items-center gap-2 px-4 h-10 rounded-control bg-surface-2 border border-line text-fg-subtle hover:text-fg hover:border-line-2 transition-colors text-sm"
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        <span className="truncate text-left flex-1">Search anything… customers, products, bills</span>
        <kbd className="hidden xl:inline-flex text-[10px] font-mono px-1.5 py-0.5 rounded bg-paper border border-line text-fg-subtle">Ctrl K</kbd>
      </button>

      <div className="flex items-center gap-2 ml-auto">
        <QueueBadge />
        <LiveClock />
        <Link to="/app/account" aria-label="Account & settings" className="relative flex items-center gap-2 rounded-full pl-1 pr-3 h-10 hover:bg-surface-2 transition-colors">
          <Avatar url={profile?.avatar_url} name={profile?.full_name} size={34} />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-xs font-semibold text-fg max-w-[130px] truncate">{profile?.full_name || 'Owner'}</span>
            <span className="text-[10px] text-fg-subtle">Owner</span>
          </span>
          <Settings className="w-4 h-4 text-fg-subtle ml-1" />
        </Link>
      </div>
    </header>
  )
}
