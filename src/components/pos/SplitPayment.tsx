import { useEffect, useState } from 'react'
import { Plus, Trash2, Wallet } from 'lucide-react'
import { formatINR } from '../../lib/format'
import { tenderStatus, type TenderLine } from '../../lib/pos'
import { buildUpiQrUrl } from '../../lib/payments'
import type { PaymentMethod } from '../../lib/types'

const METHODS: PaymentMethod[] = ['cash', 'upi', 'card', 'wallet', 'other']
const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', wallet: 'Wallet', other: 'Other' }

let tenderSeq = 0
const nextId = () => `t${++tenderSeq}-${Date.now().toString(36)}`

/**
 * SplitPayment — multiple tender lines on one sale (cash + UPI, cash
 * + card …). Live remaining / change; checkout is blocked by the
 * parent until tenders cover the total. UPI lines can show a QR the
 * customer scans at the counter; the cashier confirms receipt and the
 * tender is recorded.
 */
export function SplitPayment({
  total, tenders, onChange, upiId, payeeName, receiptRef,
}: {
  total: number
  tenders: TenderLine[]
  onChange: (t: TenderLine[]) => void
  upiId: string | null
  payeeName: string
  receiptRef: string
}) {
  const [qr, setQr] = useState<string | null>(null)
  const status = tenderStatus(total, tenders)
  const upiAmount = tenders.filter((t) => t.method === 'upi').reduce((s, t) => s + (t.amount || 0), 0)

  useEffect(() => {
    let alive = true
    if (upiId && upiAmount > 0) {
      buildUpiQrUrl({ payeeVpa: upiId, payeeName, amount: upiAmount, reference: receiptRef, note: `Payment ${receiptRef}` })
        .then((url) => { if (alive) setQr(url) })
        .catch(() => { if (alive) setQr(null) })
    } else {
      setQr(null)
    }
    return () => { alive = false }
  }, [upiId, upiAmount, payeeName, receiptRef])

  const update = (id: string, patch: Partial<TenderLine>) =>
    onChange(tenders.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const addTender = () => {
    const used = new Set(tenders.map((t) => t.method))
    const method = METHODS.find((m) => !used.has(m)) || 'cash'
    const remaining = Math.max(0, Math.round((total - status.entered) * 100) / 100)
    onChange([...tenders, { id: nextId(), method, amount: remaining || 0 }])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-fg-muted flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" /> Split across tenders
        </span>
        <span className="text-xs text-fg-subtle tabular-nums">{formatINR(status.entered)} of {formatINR(total)}</span>
      </div>

      {tenders.map((t) => (
        <div key={t.id} className="flex items-center gap-2">
          <select
            value={t.method}
            onChange={(e) => update(t.id, { method: e.target.value as PaymentMethod })}
            className="input-field py-2 w-24 text-sm capitalize"
            aria-label="Tender method"
          >
            {METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
          </select>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={t.amount || ''}
            onChange={(e) => update(t.id, { amount: Math.max(0, Number(e.target.value)) })}
            className="input-field py-2 flex-1 text-right tabular-nums"
            placeholder="0"
            aria-label="Tender amount"
          />
          <button
            onClick={() => onChange(tenders.filter((x) => x.id !== t.id))}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-subtle hover:text-negative"
            aria-label="Remove tender line"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}

      <button onClick={addTender} className="w-full py-2 rounded-xl border border-dashed border-line-2 text-xs font-semibold text-fg-muted hover:text-fg hover:border-accent flex items-center justify-center gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Add tender
      </button>

      {/* Live remaining / change */}
      <div className="flex items-center justify-between text-sm pt-1">
        <span className="text-fg-muted">{status.remaining > 0 ? 'Remaining' : 'Change due'}</span>
        <span className={`font-bold tabular-nums ${status.remaining > 0 ? 'text-warning' : 'text-positive'}`}>
          {formatINR(status.remaining > 0 ? status.remaining : status.change)}
        </span>
      </div>

      {/* UPI QR — the customer scans; the cashier confirms receipt */}
      {qr && (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-2 border border-line">
          <img src={qr} alt="UPI payment QR" className="w-24 h-24 rounded-lg bg-white p-1" />
          <div className="text-xs text-fg-muted">
            <p className="font-semibold text-fg">Customer scans to pay {formatINR(upiAmount)}</p>
            <p className="mt-1">Confirm the payment in your UPI app, then complete the sale.</p>
            {upiId && <p className="mt-1 text-fg-subtle">{upiId}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
