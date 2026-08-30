import { ChevronUp, ShoppingCart } from 'lucide-react'
import { formatINR } from '../../lib/format'
import type { SaleTotals } from '../../lib/pos'
import { QueueBadge } from '../QueueBadge'

/**
 * StickyCartBar — the collapsed cart pinned above the mobile bottom
 * nav at all times while browsing the product grid. Item count +
 * running total are always visible; tapping expands the full cart
 * and checkout sheet. The cart never scrolls out of reach.
 */
export function StickyCartBar({
  itemCount, sale, onExpand,
}: {
  itemCount: number
  sale: SaleTotals
  onExpand: () => void
}) {
  return (
    <div
      className="lg:hidden fixed inset-x-0 z-30"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 58px)' }}
    >
      <button
        onClick={onExpand}
        className="mx-3 mb-1 w-[calc(100%-1.5rem)] card px-4 py-2.5 flex items-center gap-3 shadow-float bg-surface/95 backdrop-blur text-left active:scale-[0.99] transition-transform"
        aria-label={itemCount > 0 ? `Open cart — ${itemCount} items, total ${sale.total}` : 'Open cart'}
      >
        <span className="relative flex-shrink-0">
          <span className="w-10 h-10 rounded-xl bg-accent text-accent-fg flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </span>
          {itemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-negative text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {itemCount > 99 ? '99+' : itemCount}
            </span>
          )}
        </span>
        <span className="flex-1 min-w-0">
          {itemCount > 0 ? (
            <>
              <span className="block text-xs font-medium text-fg-muted">{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
              <span className="block text-lg font-extrabold text-fg leading-tight tabular-nums">{formatINR(sale.total)}</span>
            </>
          ) : (
            <span className="block text-sm font-medium text-fg-subtle">Cart is empty — tap a product to start</span>
          )}
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 text-xs font-semibold text-accent">
            View cart <ChevronUp className="w-4 h-4" />
          </span>
          <QueueBadge />
        </span>
      </button>
    </div>
  )
}
