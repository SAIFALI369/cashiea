import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ShoppingCart, Users, Bot } from 'lucide-react'
import clsx from 'clsx'
import MerajDevice from './MerajDevice'
import type { BusinessMood } from '../lib/businessMood'

// ────────────────────────────────────────────────────────────────
// Bottom navigation (mobile) — the Meraj device-character sits in
// the CENTER slot. Its face reflects the real businessMood while
// idle; tapping it opens the floating Meraj window.
// ────────────────────────────────────────────────────────────────
export default function BottomNav({
  businessMood,
  onOpenMeraj,
}: {
  businessMood: BusinessMood | null
  onOpenMeraj: () => void
}) {
  const itemClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors',
      isActive ? 'text-accent-strong' : 'text-fg-subtle hover:text-fg-muted',
    )

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-surface/95 backdrop-blur border-t border-line shadow-[0_-8px_24px_rgb(var(--shadow)/0.08)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch max-w-md mx-auto">
        <NavLink to="/app" end className={itemClass}>
          <LayoutDashboard className="w-5 h-5" />
          Today
        </NavLink>
        <NavLink to="/app/pos" className={itemClass}>
          <ShoppingCart className="w-5 h-5" />
          New Sale
        </NavLink>

        {/* Center: Meraj device character (nav context) */}
        <button
          onClick={onOpenMeraj}
          aria-label="Open Meraj AI assistant"
          title="Meraj — your Cashiea AI assistant"
          className="relative flex flex-col items-center justify-end flex-1 pb-1 -mt-6 group"
        >
          <span className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface border border-line shadow-lift group-hover:border-accent/40 group-active:scale-95 transition-all">
            <MerajDevice
              size="sm"
              context="nav"
              interactionState="idle"
              businessMood={businessMood ?? 'neutral'}
            />
          </span>
          <span className="text-[10px] font-semibold text-accent-strong mt-0.5">Meraj</span>
        </button>

        <NavLink to="/app/customers" className={itemClass}>
          <Users className="w-5 h-5" />
          Customers
        </NavLink>
        <NavLink to="/app/assistant" className={itemClass}>
          <Bot className="w-5 h-5" />
          Ask AI
        </NavLink>
      </div>
    </nav>
  )
}
