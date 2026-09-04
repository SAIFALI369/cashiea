import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Coins, Loader2, Minus, X } from 'lucide-react'
import { formatINR } from '../../lib/format'
import { expectedCashForDay } from '../../lib/pos'
import { supabase } from '../../lib/supabase'
import type { CashSession, SalePayment, Transaction } from '../../lib/types'
import { FitAmount } from '../FitAmount'
import toast from 'react-hot-toast'

/**
 * EodModal — end-of-day cash reconciliation from the New Sale screen.
 * Expected cash comes from today's cash tender lines (plus legacy
 * cash sales recorded before tender lines existed). The cashier
 * enters the counted amount; the variance is flagged and stored in
 * cash_sessions (one row per day, upserted).
 */
export function EodModal({
  open, ownerId, canSave, onClose,
}: {
  open: boolean
  ownerId: string
  canSave: boolean
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expected, setExpected] = useState(0)
  const [cashSaleCount, setCashSaleCount] = useState(0)
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState<CashSession | null>(null)

  const todayStart = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }, [])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSaved(null)
    setCounted('')
    setNotes('')
    const day = todayStart.slice(0, 10)

    Promise.all([
      supabase.from('transactions').select('id,total,payment_method,status').eq('user_id', ownerId)
        .gte('created_at', todayStart).order('created_at', { ascending: false }).limit(500),
      supabase.from('sale_payments').select('id,transaction_id,method,amount').eq('user_id', ownerId)
        .gte('created_at', todayStart).limit(2000),
      supabase.from('cash_sessions').select('*').eq('user_id', ownerId).eq('session_date', day).maybeSingle(),
    ]).then(([txnsRes, payRes, sessRes]) => {
      const txns = (txnsRes.data as Transaction[]) || []
      const payments = (payRes.data as SalePayment[]) || []
      const cashPayments = payments.filter((p) => p.method === 'cash')
      setExpected(expectedCashForDay(txns, cashPayments))
      setCashSaleCount(txns.filter((t) => t.status === 'completed' &&
        (t.payment_method === 'cash' || t.payment_method === 'split')).length)
      if (sessRes.data) {
        setSaved(sessRes.data as CashSession)
        setCounted(String(sessRes.data.counted_cash))
        setNotes(sessRes.data.notes || '')
      }
      setLoading(false)
    })
  }, [open, ownerId, todayStart])

  if (!open) return null

  const countedNum = Number(counted) || 0
  const variance = Math.round((countedNum - expected) * 100) / 100

  const save = async () => {
    if (!canSave) {
      toast.error('Only the business owner can save the day-end cash count')
      return
    }
    if (counted === '') {
      toast.error('Enter the counted cash amount')
      return
    }
    setSaving(true)
    try {
      const row = {
        user_id: ownerId,
        session_date: todayStart.slice(0, 10),
        expected_cash: expected,
        counted_cash: countedNum,
        notes: notes.trim() || null,
      }
      const { data, error } = await supabase
        .from('cash_sessions')
        .upsert(row, { onConflict: 'user_id,session_date' })
        .select()
        .single()
      if (error) throw error
      setSaved(data as CashSession)
      toast.success('Day closed — cash count saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the cash count')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-label="Close the day">
      <div
        className="card w-full sm:max-w-sm rounded-b-none sm:rounded-card max-h-[88vh] overflow-y-auto scroll-area"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-line">
          <h3 className="font-bold text-fg flex items-center gap-2"><Coins className="w-5 h-5 text-accent" /> Close the day</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Expected */}
            <div className="rounded-xl bg-surface-2 border border-line p-3">
              <p className="text-xs font-semibold text-fg-muted">Expected cash ({cashSaleCount} cash sale{cashSaleCount !== 1 ? 's' : ''} today)</p>
              <p className="mt-0.5"><FitAmount value={formatINR(expected)} base="text-2xl" minTier="text-base" className="font-extrabold text-fg" /></p>
            </div>

            {!canSave && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-fg-muted">
                You can review today’s expected cash, but only the business owner can save the day-end count.
              </div>
            )}

            {/* Counted */}
            <div>
              <label className="label" htmlFor="eod-counted">Counted in drawer</label>
              <input
                id="eod-counted"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                disabled={!canSave}
                className="input-field text-lg font-bold tabular-nums disabled:opacity-60"
                placeholder="0"
              />
            </div>

            {/* Variance */}
            {counted !== '' && (
              <div className={`rounded-xl p-3 border flex items-center justify-between ${Math.abs(variance) < 0.005 ? 'bg-positive/10 border-positive/30' : 'bg-negative/10 border-negative/30'}`}>
                <span className="text-sm font-semibold text-fg flex items-center gap-1.5">
                  {Math.abs(variance) < 0.005 ? <Minus className="w-4 h-4 text-positive" /> : variance > 0 ? <ArrowUpRight className="w-4 h-4 text-negative" /> : <ArrowDownRight className="w-4 h-4 text-negative" />}
                  {Math.abs(variance) < 0.005 ? 'Balanced' : variance > 0 ? 'Over' : 'Short'}
                </span>
                <FitAmount value={formatINR(Math.abs(variance))} base="text-lg" minTier="text-sm" className="font-extrabold text-fg" />
              </div>
            )}

            <div>
              <label className="label" htmlFor="eod-notes">Notes</label>
              <input id="eod-notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canSave} className="input-field disabled:opacity-60" placeholder="Optional" />
            </div>

            {saved && (
              <p className="text-xs text-positive text-center">
                Saved for {saved.session_date} — updated each time you close the day.
              </p>
            )}

            {canSave && (
              <button onClick={save} disabled={saving} className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save cash count
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
