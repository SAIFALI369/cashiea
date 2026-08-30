import { useEffect, useState } from 'react'
import { AlertTriangle, Ban, History, Loader2, X } from 'lucide-react'
import { formatINR } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Profile, Transaction } from '../../lib/types'
import toast from 'react-hot-toast'

/**
 * RecentSalesModal — last sales from the New Sale screen, with the
 * cashier-initiated void / return flow: a reason is required, stock
 * is restored, daily totals self-adjust (they only count completed
 * sales), and the action is written to the activity log.
 */
export function RecentSalesModal({
  open, ownerId, profile, onVoided, onClose,
}: {
  open: boolean
  ownerId: string
  profile: Profile | null
  onVoided: () => void
  onClose: () => void
}) {
  const [sales, setSales] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [voiding, setVoiding] = useState<Transaction | null>(null)
  const [reason, setReason] = useState('')
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => { setSales((data as Transaction[]) || []); setLoading(false) })
  }, [open, ownerId])

  if (!open) return null

  const doVoid = async () => {
    if (!voiding) return
    if (!reason.trim()) {
      toast.error('A reason is required to void a sale')
      return
    }
    if (!navigator.onLine) {
      toast.error('Connect to the internet to void a sale')
      return
    }
    setWorking(true)
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          status: 'void',
          void_reason: reason.trim(),
          voided_at: new Date().toISOString(),
          voided_by: profile?.full_name || 'Cashier',
        })
        .eq('id', voiding.id)
        .eq('user_id', ownerId)
      if (error) throw error

      // Restore stock (units factor per line).
      await Promise.all(
        (voiding.items || []).map((it) =>
          supabase
            .rpc('adjust_stock', { p_id: it.product_id, qty: -(Number(it.quantity) || 0) * (Number(it.factor ?? 1) || 1) })
            .then(({ error }) => { if (error) console.warn('stock restore failed for', it.product_id, error.message) }),
        ),
      )
      if (voiding.customer_id) {
        await supabase.rpc('recompute_customer_stats', { customer_uuid: voiding.customer_id })
      }
      await supabase.from('activity_logs').insert({
        user_id: ownerId,
        action_type: 'campaign',
        description: `Voided sale ${voiding.receipt_number} (${formatINR(voiding.total)}) — ${reason.trim()}`,
        time_saved_minutes: 0,
        money_saved: 0,
        metadata: { voided_receipt: voiding.receipt_number, reason: reason.trim() },
      })

      toast.success(`Sale ${voiding.receipt_number} voided — stock restored`)
      setVoiding(null)
      setReason('')
      onVoided()
      // Refresh the list
      setLoading(true)
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data }) => { setSales((data as Transaction[]) || []); setLoading(false) })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not void the sale')
    } finally {
      setWorking(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-label="Recent sales">
        <div
          className="card w-full sm:max-w-md rounded-b-none sm:rounded-card max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-line">
            <h3 className="font-bold text-fg flex items-center gap-2"><History className="w-5 h-5 text-accent" /> Recent sales</h3>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scroll-area p-3 space-y-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
            ) : sales.length === 0 ? (
              <p className="text-sm text-fg-subtle text-center py-10">No sales recorded yet</p>
            ) : (
              sales.map((s) => (
                <div key={s.id} className={`rounded-xl border p-3 ${s.status === 'void' ? 'border-line bg-surface/40 opacity-70' : 'border-line bg-surface/60'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${s.status === 'void' ? 'text-fg-subtle line-through' : 'text-fg'}`}>
                        {s.receipt_number}
                      </p>
                      <p className="text-xs text-fg-subtle">
                        {new Date(s.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} · {s.payment_method}
                        {s.status === 'void' && s.void_reason && <> · voided: {s.void_reason}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-fg tabular-nums">{formatINR(s.total)}</span>
                      {s.status === 'completed' && (
                        <button onClick={() => { setVoiding(s); setReason('') }} className="px-2.5 py-1.5 rounded-lg border border-line text-xs font-semibold text-negative hover:bg-negative/10 flex items-center gap-1">
                          <Ban className="w-3.5 h-3.5" /> Void
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Void confirm — reason required */}
      {voiding && (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-end sm:items-center justify-center sm:p-4" onClick={() => !working && setVoiding(null)} role="dialog" aria-label="Void sale">
          <div className="card w-full sm:max-w-sm rounded-b-none sm:rounded-card p-4" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
            <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <h3 className="text-lg font-bold text-fg text-center">Void this sale?</h3>
            <p className="text-sm text-fg-muted text-center mt-1">
              {voiding.receipt_number} · {formatINR(voiding.total)}. Stock will be restored and daily totals adjusted.
            </p>
            <div className="mt-4">
              <label className="label" htmlFor="void-reason">Reason (required)</label>
              <textarea
                id="void-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field min-h-20"
                placeholder="e.g. Wrong item billed, customer returned it"
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setVoiding(null)} disabled={working} className="btn-ghost flex-1 py-3">Cancel</button>
              <button onClick={doVoid} disabled={working || !reason.trim()} className="btn-primary flex-1 py-3 bg-negative hover:bg-negative/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Void sale
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
