import { useEffect, useState } from 'react'
import { Clock, Loader2, Pause, Play, Trash2, X } from 'lucide-react'
import { formatINR } from '../../lib/format'
import { ageLabel } from '../../lib/pos'
import type { HeldCart } from '../../lib/types'
import { ConfirmDialog } from '../ConfirmDialog'

/**
 * HeldCartsModal — parked sales, reachable from the New Sale screen.
 * Each entry shows its age so nothing silently expires; clearing one
 * always asks first. Resuming restores the exact cart state.
 */
export function HeldCartsModal({
  open, heldCarts, loading, onResume, onDelete, canDelete, onClose,
}: {
  open: boolean
  heldCarts: HeldCart[]
  loading: boolean
  onResume: (h: HeldCart) => void
  onDelete: (h: HeldCart) => void
  canDelete?: (h: HeldCart) => boolean
  onClose: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState<HeldCart | null>(null)
  const [tick, setTick] = useState(0)

  // Keep ages fresh while the list is open.
  useEffect(() => {
    if (!open) return
    const i = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(i)
  }, [open])

  if (!open) return null
  void tick

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-label="Held carts">
        <div
          className="card w-full sm:max-w-md rounded-b-none sm:rounded-card max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-line">
            <h3 className="font-bold text-fg flex items-center gap-2">
              <Pause className="w-5 h-5 text-accent" /> Held carts
              {heldCarts.length > 0 && (
                <span className="text-xs font-semibold bg-accent-soft text-accent-strong px-2 py-0.5 rounded-full">{heldCarts.length}</span>
              )}
            </h3>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scroll-area p-3 space-y-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
            ) : heldCarts.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Pause className="w-8 h-8 text-fg-subtle mx-auto mb-3" />
                <p className="text-sm font-semibold text-fg">No held carts</p>
                <p className="text-xs text-fg-subtle mt-1">Tap Hold in the cart to park a sale and start a new one.</p>
              </div>
            ) : (
              heldCarts.map((h) => {
                const lines = Array.isArray((h.cart as { lines?: unknown[] })?.lines) ? (h.cart as { lines: unknown[] }).lines : []
                const note = (h.cart as { note?: string })?.note || ''
                return (
                  <div key={h.id} className="rounded-xl border border-line bg-surface/60 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-fg truncate">{h.label || note || 'Held sale'}</p>
                        <p className="text-xs text-fg-subtle flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" /> held {ageLabel(h.created_at)} · {lines.length} line{lines.length !== 1 ? 's' : ''} · {formatINR(h.total)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-fg tabular-nums">{formatINR(h.total)}</span>
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      <button onClick={() => onResume(h)} className="btn-primary flex-1 py-2 text-xs">
                        <Play className="w-3.5 h-3.5" /> Resume
                      </button>
                      {(!canDelete || canDelete(h)) && <button onClick={() => setConfirmDelete(h)} className="px-3 py-2 rounded-xl border border-line text-negative hover:bg-negative/10" aria-label={`Delete held cart ${h.label || ''}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete held cart?"
        message={`"${confirmDelete?.label || 'Held sale'}" (${formatINR(confirmDelete?.total || 0)}) will be removed. This cannot be undone.`}
        confirmLabel="Delete"
        danger={true}
        onConfirm={() => { onDelete(confirmDelete!); setConfirmDelete(null) }}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  )
}
