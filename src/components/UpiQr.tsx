import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, Loader2 } from 'lucide-react'
import { buildUpiLink, copyToClipboard } from '../lib/payments'
import { formatINR } from '../lib/format'
import toast from 'react-hot-toast'

/**
 * UpiQr — UPI payment QR with honest states:
 *   • loading while the code renders locally
 *   • the QR image, with onError catching broken renders
 *   • failure → UPI ID fallback panel instead of a broken image
 * The UPI ID + a Copy action are always available below the code.
 */
export function UpiQr({
  upiId, payeeName, amount, reference, note, size = 192,
}: {
  upiId: string
  payeeName: string
  amount: number
  reference?: string
  note?: string
  size?: number
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    setState('loading')
    setQrUrl(null)
    ;(async () => {
      try {
        const QRCode = (await import('qrcode')).default
        const link = buildUpiLink({ payeeVpa: upiId, payeeName, amount, reference, note })
        const url = await QRCode.toDataURL(link, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
        if (!alive) return
        setQrUrl(url)
        setState('ready')
      } catch {
        if (alive) setState('error')
      }
    })()
    return () => { alive = false }
  }, [upiId, payeeName, amount, reference, note])

  const copyUpi = async () => {
    const ok = await copyToClipboard(upiId)
    if (ok) {
      setCopied(true)
      toast.success('UPI ID copied')
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {state === 'loading' && (
        <div className="rounded-xl bg-white p-2 flex items-center justify-center" style={{ width: size, height: size }} aria-label="Generating QR code" role="status">
          <Loader2 className="w-7 h-7 animate-spin text-fg-subtle" />
        </div>
      )}

      {state === 'ready' && qrUrl && (
        <img
          src={qrUrl}
          alt={`UPI QR — pay ${formatINR(amount)} to ${upiId}`}
          className="rounded-xl bg-white p-2"
          style={{ width: size, height: size }}
          onError={() => setState('error')}
        />
      )}

      {state === 'error' && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-center" style={{ width: size }} role="alert">
          <AlertTriangle className="w-5 h-5 text-warning mx-auto mb-1.5" />
          <p className="text-xs font-semibold text-fg">QR code could not be generated</p>
          <p className="text-[11px] text-fg-muted mt-0.5">Pay directly to the UPI ID below</p>
        </div>
      )}

      {/* UPI ID + copy — always available */}
      <div className="flex items-center gap-1.5">
        <code className="text-xs font-semibold text-fg bg-surface-2 border border-line rounded-lg px-2.5 py-1.5 select-all">{upiId}</code>
        <button
          onClick={copyUpi}
          className="w-9 h-9 rounded-lg border border-line bg-surface flex items-center justify-center text-fg-muted hover:text-fg active:scale-95 transition-all"
          aria-label="Copy UPI ID"
          title="Copy UPI ID"
        >
          {copied ? <Check className="w-4 h-4 text-positive" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
