import { ChevronUp, ShoppingCart } from 'lucide-react'
import { formatINR } from '../../lib/format'
import type { SaleTotals } from '../../lib/pos'
import { QueueBadge } from '../QueueBadge'
import { FitAmount } from '../FitAmount'

/**
 * StickyCartBar — the collapsed cart, always pinned above the mobile nav.
 *
 * Empty: a quiet, translucent strip that states its purpose and stays out
 * of the way. Active: it becomes a solid dock showing the running total
 * and a green Charge-style affordance, and tapping it raises the full
 * sheet. The cart is never more than one tap away, and never covers the
 * grid the cashier is browsing.
 */
export function StickyCartBar({
  itemCount, sale, onExpand,
}: {
  itemCount: number
  sale: SaleTotals
  onExpand: () => void
}) {
  const active = itemCount > 0

  if (!active) {
    return (
      <div className="lg:hidden fixed inset-x-0 z-30 px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 58px)' }}>
        <div className="mb-1 rounded-2xl bg-surface/80 backdrop-blur px-4 py-2.5 flex items-center gap-2.5 shadow-sm">
          <ShoppingCart className="w-4 h-4 text-fg-subtle flex-shrink-0" />
          <span className="text-sm text-fg-subtle">Cart is empty. Add items to get started.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="lg:hidden fixed inset-x-0 z-30 px-3" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 58px)' }}>
      <button
        onClick={onExpand}
        className="w-full mb-1 rounded-2xl bg-surface shadow-float px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
        aria-label={`Open cart — ${itemCount} items, total ${formatINR(sale.total)}`}
      >
        <span className="relative flex-shrink-0">
          <span className="w-10 h-10 rounded-xl bg-accent text-white flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </span>
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-fg text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
            {itemCount > 99 ? '99+' : itemCount}
          </span>
        </span>

        <span className="flex-1 min-w-0">
          <span className="block text-xs font-medium text-fg-subtle">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
          <span className="block leading-tight">
            <FitAmount value={formatINR(sale.total)} base="text-lg" minTier="text-sm" className="font-bold text-fg" />
          </span>
        </span>

        <span className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="flex items-center gap-1 text-xs font-bold text-accent">
            View cart <ChevronUp className="w-4 h-4" />
          </span>
          <QueueBadge />
        </span>
      </button>
    </div>
  )
}
