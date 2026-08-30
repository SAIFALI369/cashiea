import { Trash2, X } from 'lucide-react'
import { formatINR } from '../../lib/format'
import { GST_RATES } from '../../lib/gst'
import type { CartLine } from '../../lib/pos'

/**
 * LineOptionsModal — per-line controls for a cart item:
 *   • direct quantity entry (numpad)
 *   • GST rate for this line (product rate / manual override)
 *   • "price includes GST" toggle (MRP-style pricing)
 *   • flat line discount with a reason that surfaces in Reports
 *   • remove the line
 */
export function LineOptionsModal({
  line, unitPrice, onPatch, onRemove, onNumpad, onClose,
}: {
  line: CartLine
  unitPrice: number
  onPatch: (key: string, patch: Partial<CartLine>) => void
  onRemove: (key: string) => void
  onNumpad: () => void
  onClose: () => void
}) {
  if (!line) return null
  const key = line.key

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-label={`Options for ${line.name}`}>
      <div
        className="card w-full sm:max-w-sm rounded-b-none sm:rounded-card max-h-[88vh] overflow-y-auto scroll-area"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between p-4 pb-3 border-b border-line sticky top-0 bg-surface">
          <div className="min-w-0">
            <h3 className="font-bold text-fg truncate">{line.name}</h3>
            <p className="text-xs text-fg-subtle">{formatINR(unitPrice)} each{line.unit ? ` per ${line.unit}` : ''}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Quantity */}
          <div className="flex items-center justify-between">
            <span className="label mb-0">Quantity{line.unit ? ` (${line.unit})` : ''}</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-fg tabular-nums">{line.quantity}</span>
              <button onClick={onNumpad} className="btn-ghost py-1.5 px-3 text-xs">Enter quantity</button>
            </div>
          </div>

          {/* GST rate */}
          <div>
            <span className="label">GST rate on this line</span>
            <div className="flex flex-wrap gap-1.5">
              {GST_RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => onPatch(key, { gst_rate: r, gst_source: 'manual' })}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${line.gst_rate === r && line.gst_source === 'manual' ? 'bg-accent text-accent-fg border-accent' : 'border-line text-fg-muted hover:text-fg'}`}
                  aria-pressed={line.gst_rate === r && line.gst_source === 'manual'}
                >
                  {r}%
                </button>
              ))}
              <button
                onClick={() => onPatch(key, { gst_rate: 0, gst_source: 'sale' })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${line.gst_source === 'sale' ? 'bg-accent text-accent-fg border-accent' : 'border-line text-fg-muted hover:text-fg'}`}
                title="Follow the sale-level Tax % field"
              >
                Sale default
              </button>
            </div>
            <p className="text-[11px] text-fg-subtle mt-1.5">
              {line.gst_source === 'product' && 'Using the product\'s saved GST rate.'}
              {line.gst_source === 'sale' && 'Following the Tax % field in the cart.'}
              {line.gst_source === 'manual' && 'Manually set for this sale.'}
            </p>
          </div>

          {/* Inclusive pricing */}
          <button
            onClick={() => onPatch(key, { price_includes_tax: !line.price_includes_tax })}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-line"
            role="switch"
            aria-checked={line.price_includes_tax}
          >
            <span className="text-left">
              <span className="block text-sm font-semibold text-fg">Price includes GST</span>
              <span className="block text-xs text-fg-subtle">MRP-style pricing — tax is backed out of the entered price</span>
            </span>
            <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${line.price_includes_tax ? 'bg-accent' : 'bg-line-2'}`}>
              <span className={`block w-5 h-5 rounded-full bg-surface shadow transition-transform ${line.price_includes_tax ? 'translate-x-5' : ''}`} />
            </span>
          </button>

          {/* Line discount */}
          <div>
            <span className="label">Line discount (₹)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={line.line_discount ?? ''}
              onChange={(e) => onPatch(key, { line_discount: Math.max(0, Number(e.target.value)) })}
              className="input-field"
              placeholder="0"
              aria-label="Line discount amount"
            />
            <input
              value={line.line_discount_note || ''}
              onChange={(e) => onPatch(key, { line_discount_note: e.target.value })}
              className="input-field mt-2"
              placeholder="Reason (shows in Reports)"
              aria-label="Line discount reason"
            />
          </div>

          {/* Remove */}
          <button
            onClick={() => { onRemove(key); onClose() }}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-negative hover:bg-negative/10 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Remove line
          </button>
        </div>
      </div>
    </div>
  )
}
