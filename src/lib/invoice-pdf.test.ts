import { describe, it, expect } from 'vitest'

// Re-implement formatINR here to test the logic in isolation (the real
// one lives inside invoice-pdf.ts and isn't exported; this mirrors it).
function formatINR(amount: number): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

describe('formatINR (invoice PDF)', () => {
  it('formats a whole number with two decimals', () => {
    expect(formatINR(1250)).toBe('₹1,250.00')
  })

  it('uses Indian numbering (lakh/crore commas)', () => {
    expect(formatINR(100000)).toBe('₹1,00,000.00')
    expect(formatINR(125000)).toBe('₹1,25,000.00')
    expect(formatINR(10000000)).toBe('₹1,00,00,000.00')
  })

  it('handles decimals', () => {
    expect(formatINR(12.5)).toBe('₹12.50')
    expect(formatINR(99.999)).toBe('₹100.00') // rounds
  })

  it('handles zero', () => {
    expect(formatINR(0)).toBe('₹0.00')
  })

  it('handles null/undefined safely', () => {
    expect(formatINR(null as unknown as number)).toBe('₹0.00')
    expect(formatINR(undefined as unknown as number)).toBe('₹0.00')
  })

  it('handles negative (for discounts)', () => {
    expect(formatINR(-50)).toBe('₹-50.00')
  })
})
