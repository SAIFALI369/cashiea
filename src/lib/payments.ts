// ════════════════════════════════════════════════════════════════
// UPI + WhatsApp payment helpers (zero-setup, native deep links).
//
// These generate deep links that work natively on Indian phones:
//  - upi:// links open any installed UPI app (PhonePe, GPay, Paytm, BHIM)
//  - wa.me links open WhatsApp with a pre-filled message
//
// No payment gateway, no API keys, no setup. Works the moment you
// deploy — perfect for Indian retail.
// ════════════════════════════════════════════════════════════════

export interface UPIParams {
  /** Merchant UPI VPA, e.g. "myshop@okhdfcbank" or "shop@paytm" */
  payeeVpa: string
  /** Display name shown in the UPI app */
  payeeName: string
  amount: number
  /** Invoice / order number */
  reference?: string
  note?: string
}

/**
 * Build a UPI deep link. Opens any installed UPI app on Android/iOS.
 * Format: upi://pay?pa=VPA&pn=NAME&am=AMOUNT&tr=REF&tn=NOTE&cu=INR
 */
export function buildUpiLink(p: UPIParams): string {
  const params = new URLSearchParams({
    pa: p.payeeVpa,
    pn: p.payeeName,
    am: p.amount.toFixed(2),
    cu: 'INR',
  })
  if (p.reference) params.set('tr', p.reference)
  if (p.note) params.set('tn', p.note)
  return `upi://pay?${params.toString()}`
}

/**
 * Generate a QR code data URL for a UPI payment (scannable by any UPI app).
 * Uses the QR-server.com public API — no key needed. Falls back to a
 * Google Chart-style URL. Returns an image URL you can <img src>.
 */
export async function buildUpiQrUrl(p: UPIParams): Promise<string> {
  const upiLink = buildUpiLink(p)
  // Client-side QR generation — no external service, no network dependency,
  // works offline. Uses the `qrcode` npm package (canvas → data URL).
  try {
    const QRCode = (await import('qrcode')).default
    const dataUrl = await QRCode.toDataURL(upiLink, {
      width: 240, margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
    return dataUrl
  } catch {
    // Fallback: if QR generation somehow fails, return the UPI link as-is
    // (the app can still show a "Pay via UPI" text link)
    return upiLink
  }
}

export interface InvoiceShare {
  invoiceNumber: string
  clientName: string
  amount: number
  payeeVpa?: string
  payeeName: string
  paymentLink?: string
  dueDate?: string
}

/**
 * Build the message text for sharing an invoice (WhatsApp / SMS / email).
 */
export function buildInvoiceMessage(inv: InvoiceShare): string {
  const lines = [
    `🧾 *Invoice ${inv.invoiceNumber}*`,
    `To: ${inv.clientName}`,
    `Amount: ₹${inv.amount.toFixed(2)}`,
  ]
  if (inv.dueDate) lines.push(`Due: ${inv.dueDate}`)
  if (inv.paymentLink) lines.push('', '💳 Pay instantly via UPI:', inv.paymentLink)
  lines.push('', `— ${inv.payeeName}`)
  return lines.join('\n')
}

/**
 * WhatsApp share link. Opens WhatsApp with the message pre-filled.
 * If a phone number is provided, opens chat with that contact.
 */
export function buildWhatsappLink(phone: string | undefined, message: string): string {
  const cleaned = phone ? phone.replace(/[^\d]/g, '').replace(/^0+/, '') : ''
  // Indian numbers need 91 prefix if not present
  const num = cleaned && cleaned.length === 10 ? `91${cleaned}` : cleaned
  const base = num ? `https://wa.me/${num}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(message)}`
}

/** SMS share link (opens the SMS app pre-filled). */
export function buildSmsLink(phone: string | undefined, message: string): string {
  const cleaned = phone ? phone.replace(/[^\d]/g, '') : ''
  return `sms:${cleaned}?&body=${encodeURIComponent(message)}`
}

/**
 * Copy any text to clipboard with a graceful fallback for mobile browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch { /* fall through */ }
  // Fallback: hidden textarea + execCommand
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
