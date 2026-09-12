import { useState } from 'react'
import {
  Check, Copy, Download, Link2, Loader2, Mail, MessageCircle, Printer, Send, ShoppingCart,
} from 'lucide-react'
import { formatINR } from '../../lib/format'
import { buildReceiptText, type ReceiptModel } from '../../lib/pos'
import { printReceiptPdf } from '../../lib/receipt-pdf'
import { downloadDigitalReceiptPdf } from '../../lib/digital-receipt-pdf'
import { copyToClipboard } from '../../lib/payments'
import type { Profile } from '../../lib/types'
import { supabase } from '../../lib/supabase'
import { FitAmount } from '../FitAmount'
import toast from 'react-hot-toast'

/**
 * ReceiptModal — the success state, then the delivery sheet.
 *
 * Two steps, because they answer different questions. First: did the
 * money land? A big green mark that scales in with a bounce, the amount,
 * and the two things a cashier actually does next — send the receipt, or
 * start the next sale. Only if they choose "Send receipt" do the delivery
 * channels appear, so the common path (cash sale, no receipt) is two taps.
 */
export function ReceiptModal({
  receipt, profile, phone, onClose,
}: {
  receipt: ReceiptModel
  profile: Profile | null
  phone: string | null
  onClose: () => void
}) {
  const [step, setStep] = useState<'success' | 'share'>('success')
  const [waPhone, setWaPhone] = useState(phone || '')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)

  // The keepsake A5 receipt (QR, generous margins) rather than the 80 mm
  // thermal slip — that one stays behind "Print slip" for the counter roll.
  const savePdf = async () => {
    setSaving(true)
    try {
      await downloadDigitalReceiptPdf(receipt, profile)
    } catch {
      toast.error('Could not build the PDF')
    } finally {
      setSaving(false)
    }
  }

  const sendWhatsApp = async () => {
    const to = waPhone.replace(/[^0-9+]/g, '')
    if (to.length < 10) { toast.error('Enter a valid phone number'); return }
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

  // "Copy link" without a hosted receipt page would hand the customer a
  // dead URL, so we copy the receipt text itself — honest and useful.
  const copyReceipt = async () => {
    const ok = await copyToClipboard(buildReceiptText(receipt))
    if (ok) {
      setCopied(true)
      toast.success('Receipt copied')
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Could not copy')
    }
  }

  const emailReceipt = () => {
    const subject = encodeURIComponent(`Receipt ${receipt.receiptNumber} — ${receipt.shopName}`)
    const body = encodeURIComponent(buildReceiptText(receipt))
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-label="Sale complete"
    >
      <div
        className="pos-sheet bg-surface w-full sm:max-w-sm rounded-t-[24px] sm:rounded-[24px] max-h-[92vh] overflow-y-auto scroll-area"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {/* Drag handle */}
        <div className="pt-2.5 pb-1 flex justify-center">
          <span className="w-10 h-1 rounded-full bg-line-2" aria-hidden="true" />
        </div>

        {step === 'success' ? (
          <div className="px-6 pt-4 pb-6 text-center">
            <div className="pos-success-mark w-20 h-20 rounded-full bg-accent flex items-center justify-center mx-auto mb-5">
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </div>

            <h3 className="text-xl font-bold text-fg">Payment successful</h3>
            <p className="mt-1"><FitAmount value={formatINR(receipt.total)} base="text-3xl" minTier="text-xl" className="font-bold text-fg" /></p>
            <p className="text-xs text-fg-subtle mt-1.5">
              {receipt.receiptNumber} · {receipt.tenders.map((t) => t.method.toUpperCase()).join(' + ')}
              {receipt.change > 0 && <> · change {formatINR(receipt.change)}</>}
            </p>

            <div className="mt-7 space-y-2.5">
              <button
                onClick={() => setStep('share')}
                className="w-full py-4 rounded-2xl bg-accent text-white text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Send className="w-4 h-4" /> Send receipt
              </button>
              <button
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-surface-2 text-fg text-base font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <ShoppingCart className="w-4 h-4" /> New sale
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 pt-3 pb-5">
            <h3 className="text-lg font-bold text-fg text-center mb-1">Send this receipt</h3>
            <p className="text-xs text-fg-subtle text-center mb-5">{receipt.receiptNumber} · {formatINR(receipt.total)}</p>

            {/* WhatsApp — the primary channel in India */}
            <div className="rounded-xl bg-surface-2 p-3 mb-2.5">
              <label htmlFor="wa-phone" className="text-xs font-semibold text-fg-muted flex items-center gap-1.5 mb-2">
                <MessageCircle className="w-3.5 h-3.5 text-accent" /> WhatsApp
              </label>
              <div className="flex gap-2">
                <input
                  id="wa-phone"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-surface text-sm text-fg border-0 focus:ring-2 focus:ring-accent/40 focus:outline-none"
                  placeholder="Customer phone"
                  inputMode="tel"
                />
                <button
                  onClick={sendWhatsApp}
                  disabled={sending}
                  className="px-4 rounded-lg bg-accent text-white text-sm font-bold flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.97] transition-transform"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <ShareTile icon={Mail} label="Email" onClick={emailReceipt} />
              <ShareTile icon={copied ? Check : Copy} label={copied ? 'Copied' : 'Copy text'} onClick={copyReceipt} />
              <ShareTile icon={Download} label="Download PDF" onClick={savePdf} busy={saving} />
              <ShareTile icon={Printer} label="Print slip" onClick={() => printReceiptPdf(receipt, profile)} />
            </div>

            <button onClick={onClose} className="w-full mt-4 py-3.5 rounded-2xl bg-surface-2 text-fg font-bold text-sm active:scale-[0.98] transition-transform">
              Done — new sale
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ShareTile({ icon: Icon, label, onClick, busy }: { icon: typeof Link2; label: string; onClick: () => void; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl bg-surface-2 text-fg-muted hover:text-fg active:scale-[0.97] transition-all disabled:opacity-60"
    >
      {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Icon className="w-5 h-5" />}
      <span className="text-xs font-semibold">{label}</span>
    </button>
  )
}
