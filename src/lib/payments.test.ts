import { describe, it, expect } from 'vitest'
import {
  buildUpiLink,
  buildUpiQrUrl,
  buildInvoiceMessage,
  buildWhatsappLink,
  buildSmsLink,
} from './payments'

describe('buildUpiLink', () => {
  it('builds a valid upi:// deep link with required params', () => {
    const link = buildUpiLink({ payeeVpa: 'shop@paytm', payeeName: 'My Shop', amount: 500 })
    expect(link.startsWith('upi://pay?')).toBe(true)
    expect(link).toContain('pa=shop%40paytm')
    expect(link).toContain('pn=My+Shop')
    expect(link).toContain('am=500.00')
    expect(link).toContain('cu=INR')
  })

  it('includes optional reference and note when provided', () => {
    const link = buildUpiLink({ payeeVpa: 'shop@paytm', payeeName: 'Shop', amount: 100, reference: 'INV-1', note: 'Payment' })
    expect(link).toContain('tr=INV-1')
    expect(link).toContain('tn=Payment')
  })

  it('omits reference and note when not provided', () => {
    const link = buildUpiLink({ payeeVpa: 'shop@paytm', payeeName: 'Shop', amount: 100 })
    expect(link).not.toContain('tr=')
    expect(link).not.toContain('tn=')
  })

  it('formats amount with two decimals', () => {
    const link = buildUpiLink({ payeeVpa: 'x@y', payeeName: 'S', amount: 12.5 })
    expect(link).toContain('am=12.50')
  })
})

describe('buildUpiQrUrl', () => {
  it('generates a client-side QR code as a data URL', async () => {
    const url = await buildUpiQrUrl({ payeeVpa: 'shop@paytm', payeeName: 'Shop', amount: 200 })
    expect(typeof url).toBe('string')
    expect(url.length).toBeGreaterThan(100) // data URLs are long
  })
})

describe('buildInvoiceMessage', () => {
  it('includes invoice number, client, and amount', () => {
    const msg = buildInvoiceMessage({ invoiceNumber: 'INV-42', clientName: 'Ramesh', amount: 1500, payeeName: 'My Shop' })
    expect(msg).toContain('INV-42')
    expect(msg).toContain('Ramesh')
    expect(msg).toContain('₹1500.00')
    expect(msg).toContain('My Shop')
  })

  it('includes payment link when provided', () => {
    const msg = buildInvoiceMessage({ invoiceNumber: 'INV-1', clientName: 'C', amount: 100, payeeName: 'S', paymentLink: 'upi://pay?pa=x' })
    expect(msg).toContain('upi://pay?pa=x')
    expect(msg).toContain('Pay instantly')
  })

  it('includes due date when provided', () => {
    const msg = buildInvoiceMessage({ invoiceNumber: 'INV-1', clientName: 'C', amount: 100, payeeName: 'S', dueDate: '2026-07-31' })
    expect(msg).toContain('Due: 2026-07-31')
  })
})

describe('buildWhatsappLink', () => {
  it('builds a wa.me link with no phone (opens contact picker)', () => {
    const link = buildWhatsappLink(undefined, 'Hi')
    expect(link).toBe('https://wa.me/?text=Hi')
  })

  it('adds 91 prefix to 10-digit Indian numbers', () => {
    const link = buildWhatsappLink('9876543210', 'Hi')
    expect(link.startsWith('https://wa.me/919876543210')).toBe(true)
  })

  it('preserves longer numbers with country code', () => {
    const link = buildWhatsappLink('919876543210', 'Hi')
    expect(link.startsWith('https://wa.me/919876543210')).toBe(true)
  })

  it('URL-encodes the message', () => {
    const link = buildWhatsappLink(undefined, 'Hello World & ₹500')
    expect(link).toContain('Hello%20World')
    expect(link).toContain('%26')
  })

  it('strips non-digits from phone', () => {
    const link = buildWhatsappLink('+91 98765-43210', 'Hi')
    expect(link.startsWith('https://wa.me/919876543210')).toBe(true)
  })
})

describe('buildSmsLink', () => {
  it('builds an sms: link with body', () => {
    const link = buildSmsLink('9876543210', 'Hi there')
    expect(link.startsWith('sms:9876543210')).toBe(true)
    expect(link).toContain('body=Hi%20there')
  })

  it('works with no phone', () => {
    const link = buildSmsLink(undefined, 'Hi')
    expect(link.startsWith('sms:')).toBe(true)
  })
})
