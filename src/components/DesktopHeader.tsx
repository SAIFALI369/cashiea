import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LiveClock } from './LiveClock'
import { QueueBadge } from './QueueBadge'
import { SyncIndicator } from './SyncIndicator'
import { Avatar } from './Avatar'
import { CashieaLogo } from './CashieaLogo'
import { Settings, Search, Menu, Lightbulb } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * DesktopHeader — sticky top bar shown ONLY on the desktop shell (≥lg).
 * Brand (left) · optional menu button · global search · sync queue ·
 * clock · account (right). `showMenuButton` appears on primary pages
 * (Dashboard/POS/Stocks/Customers) where the sidebar is default-hidden
 * for a full-bleed workstation feel — tapping it opens the drawer.
 */
export default function DesktopHeader({ onMenu, showMenuButton }: { onMenu?: () => void; showMenuButton?: boolean }) {
  const { profile } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="hidden lg:flex sticky top-0 z-30 bg-surface/85 backdrop-blur border-b border-line px-6 xl:px-10 h-16 items-center gap-4 shrink-0">
      {showMenuButton && (
        <button
          onClick={onMenu}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
          aria-label="Open menu"
          title="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
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
        <Link to="/app/suggestions" aria-label="Open suggestions" title="Suggestions" className="relative icon-btn w-10 h-10 min-w-10">
          <Lightbulb className="w-4.5 h-4.5 text-accent" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-positive ring-2 ring-surface" aria-label="New suggestion available" />
        </Link>
        <SyncIndicator className="hidden xl:inline-flex" />
        <QueueBadge />
        <LiveClock />
        <Link to="/app/account" aria-label="Account & settings" className="relative flex items-center gap-2 rounded-full pl-1 pr-3 h-10 hover:bg-surface-2 transition-colors">
          <Avatar url={profile?.avatar_url} name={profile?.full_name} size={34} />
          <span className="flex flex-col items-start leading-tight">
            <span className="text-xs font-semibold text-fg max-w-[130px] truncate">{profile?.full_name || 'Owner'}</span>
            <span className="text-[10px] text-fg-subtle capitalize">{profile?.role || 'account'}</span>
          </span>
          <Settings className="w-4 h-4 text-fg-subtle ml-1" />
        </Link>
      </div>
    </header>
  )
}
