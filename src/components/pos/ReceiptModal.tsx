import { useState } from 'react'
import { CheckCircle2, Download, Loader2, MessageCircle, Printer, X } from 'lucide-react'
import { formatINR } from '../../lib/format'
import { buildReceiptText, type ReceiptModel } from '../../lib/pos'
import { downloadReceiptPdf, printReceiptPdf } from '../../lib/receipt-pdf'
import type { Profile } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

/**
 * ReceiptModal — the digital receipt shown after checkout.
 *   • Download PDF (80 mm counter format)
 *   • Send on WhatsApp (reuses the whatsapp-send edge function)
 *   • Print receipt (browser print of the same PDF — the slot for
 *     dedicated thermal printers later)
 */
export function ReceiptModal({
  receipt, profile, phone, onClose,
}: {
  receipt: ReceiptModel
  profile: Profile | null
  phone: string | null
  onClose: () => void
}) {
  const [waPhone, setWaPhone] = useState(phone || '')
  const [sending, setSending] = useState(false)

  const sendWhatsApp = async () => {
    const to = waPhone.replace(/[^0-9+]/g, '')
    if (to.length < 10) {
      toast.error('Enter a valid phone number')
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.functions.invoke('whatsapp-send', {
        body: { to, message: buildReceiptText(receipt) },
      })
      if (error) throw error
      toast.success('Receipt sent on WhatsApp')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the receipt')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose} role="dialog" aria-label="Receipt">
      <div
        className="card w-full sm:max-w-sm rounded-b-none sm:rounded-card max-h-[90vh] overflow-y-auto scroll-area"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <h3 className="font-bold text-fg">Sale complete</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-2">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-center px-4 pb-2">
          <div className="w-14 h-14 rounded-full bg-positive/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-positive" />
          </div>
          <p className="text-xs text-fg-muted">Receipt {receipt.receiptNumber}</p>
          <p className="text-3xl font-extrabold text-fg tabular-nums my-1">{formatINR(receipt.total)}</p>
          <p className="text-xs text-fg-subtle">
            {receipt.tenders.map((t) => t.method.toUpperCase()).join(' + ')}
            {receipt.change > 0 && <> · change {formatINR(receipt.change)}</>}
          </p>
        </div>

        <div className="p-4 space-y-2">
          <button onClick={() => downloadReceiptPdf(receipt, profile)} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Download PDF
          </button>

          {/* WhatsApp — customer number or manual entry */}
          <div className="flex gap-2">
            <input
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              className="input-field flex-1"
              placeholder="Customer phone"
              inputMode="tel"
              aria-label="Customer phone for WhatsApp receipt"
            />
            <button onClick={sendWhatsApp} disabled={sending} className="btn-ghost px-4 flex items-center gap-2 disabled:opacity-50" aria-label="Send receipt on WhatsApp">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />} Send
            </button>
          </div>

          <button onClick={() => printReceiptPdf(receipt, profile)} className="w-full py-3 rounded-xl border border-line text-sm font-semibold text-fg-muted hover:text-fg hover:border-line-2 flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" /> Print receipt
          </button>

          <button onClick={onClose} className="btn-ghost w-full py-3">New sale</button>
        </div>
      </div>
    </div>
  )
}
