import { NavLink, Link } from 'react-router-dom'
import clsx from 'clsx'
import { LayoutDashboard, ShoppingCart, Users, LayoutGrid } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { MerajMark } from './MerajMark'

/**
 * BottomNav — mobile-only primary navigation, thumb-reachable, one-handed.
 * The CENTER slot is an elevated Meraj (AI) button — the one fixed, persistent
 * AI access point across every screen. 44px+ hit targets. Hidden on desktop.
 */
interface Item { to: string; label: string; icon: LucideIcon; end?: boolean }
const LEFT: Item[] = [
  { to: '/app', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/app/pos', label: 'New Sale', icon: ShoppingCart },
]
const RIGHT: Item[] = [
  { to: '/app/customers', label: 'Customers', icon: Users },
]

const Slot = ({ item }: { item: Item }) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) => clsx(
      'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors',
      isActive ? 'text-accent' : 'text-fg-subtle hover:text-fg'
    )}
  >
    {({ isActive }) => (
      <>
        <item.icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.25 : 1.75} />
        <span className="text-[10px] font-semibold">{item.label}</span>
      </>
    )}
  </NavLink>
)

export default function BottomNav({ onMore }: { onMore: () => void }) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5 max-w-md mx-auto items-center">
        {LEFT.map((it) => <Slot key={it.to} item={it} />)}

        {/* Center — elevated Meraj (persistent AI access) */}
        <div className="flex justify-center">
          <Link
            to="/app/assistant"
            className="flex flex-col items-center justify-center gap-0.5 min-h-[56px]"
            aria-label="Ask Meraj"
          >
            <span className="w-12 h-12 -mt-6 rounded-full bg-accent-strong text-accent-fg shadow-float ring-4 ring-surface flex items-center justify-center active:scale-95 transition-transform">
              <MerajMark size={24} />
            </span>
            <span className="text-[10px] font-bold text-accent -mt-0.5">Meraj</span>
          </Link>
        </div>

        {RIGHT.map((it) => <Slot key={it.to} item={it} />)}

        <button
          onClick={onMore}
          className="flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-fg-subtle hover:text-fg transition-colors"
          aria-label="More"
        >
          <LayoutGrid className="w-[22px] h-[22px]" strokeWidth={1.75} />
          <span className="text-[10px] font-semibold">More</span>
        </button>
      </div>
    </nav>
  )
}
