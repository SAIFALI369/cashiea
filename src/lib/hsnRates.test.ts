import { describe, it, expect } from 'vitest'
import { HSN_RATE_ENTRIES, lookupHsnRate, suggestGstRate } from './hsnRates'

describe('HSN_RATE_ENTRIES dataset integrity', () => {
  it('has unique codes', () => {
    const codes = HSN_RATE_ENTRIES.map((e) => e.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
  it('uses only sane rates', () => {
    for (const e of HSN_RATE_ENTRIES) {
      expect([0, 3, 5, 12, 18, 28, 40]).toContain(e.gstRate)
      if (e.legacyRate !== undefined) expect([0, 3, 5, 12, 18, 28]).toContain(e.legacyRate)
      if (e.altRate !== undefined) expect(e.altRate).toBeGreaterThan(e.gstRate)
    }
  })
  it('codes are 2-6 digit strings', () => {
    for (const e of HSN_RATE_ENTRIES) {
      expect(e.code).toMatch(/^\d{2,6}$/)
    }
  })
  it('marks GST 2.0 changes with the 22 Sep 2025 date', () => {
    const changed = HSN_RATE_ENTRIES.filter((e) => e.legacyRate !== undefined)
    expect(changed.length).toBeGreaterThan(20)
    for (const e of changed) expect(e.wef).toBe('2025-09-22')
  })
  it('covers the everyday kirana + stationery codes', () => {
    for (const code of ['1006', '4820', '9609', '3004', '3401', '6109', '6403', '8517', '2202', '2523']) {
      expect(lookupHsnRate(code)).not.toBeNull()
    }
  })
})

describe('lookupHsnRate — longest prefix wins', () => {
  it('resolves an 8-digit code to its most specific heading', () => {
    expect(lookupHsnRate('48201010')?.code).toBe('4820')
    expect(lookupHsnRate('30049011')?.code).toBe('3004')
  })
  it('falls back to the 2-digit chapter', () => {
    expect(lookupHsnRate('1006')?.code).toBe('10') // rice → cereals
    expect(lookupHsnRate('85362090')?.code).toBe('8536')
  })
  it('returns null for unknown chapters', () => {
    expect(lookupHsnRate('9999')).toBeNull()
    expect(lookupHsnRate('')).toBeNull()
    expect(lookupHsnRate('not-a-code')).toBeNull()
  })
  it('ignores formatting noise', () => {
    expect(lookupHsnRate(' 4820 ')?.code).toBe('4820')
    expect(lookupHsnRate('48-20')?.code).toBe('4820')
  })
})

describe('suggestGstRate — post GST 2.0 (22 Sep 2025)', () => {
  it('notebooks are nil-rated after GST 2.0 (was 12%)', () => {
    const s = suggestGstRate('4820')!
    expect(s.rate).toBe(0)
    expect(s.basis).toContain('was 12%')
  })
  it('soap and shampoo are 5% (was 18%)', () => {
    expect(suggestGstRate('3401')!.rate).toBe(5)
    expect(suggestGstRate('3305')!.rate).toBe(5)
  })
  it('medicines are 5% (was 12%)', () => {
    expect(suggestGstRate('3004')!.rate).toBe(5)
  })
  it('aerated drinks are 40% (was 28%)', () => {
    expect(suggestGstRate('2202')!.rate).toBe(40)
  })
  it('cement is 18% (was 28%)', () => {
    expect(suggestGstRate('2523')!.rate).toBe(18)
  })
  it('mobile phones stay 18%', () => {
    expect(suggestGstRate('8517')!.rate).toBe(18)
  })
  it('gold jewellery stays 3%', () => {
    expect(suggestGstRate('7113')!.rate).toBe(3)
  })
  it('staple foods are nil', () => {
    expect(suggestGstRate('1006')!.rate).toBe(0) // rice
    expect(suggestGstRate('0401')?.rate).toBe(0) // milk → chapter 4
    expect(suggestGstRate('4901')?.rate).toBe(0) // books → chapter 49
  })

  it('apparel splits on the ₹2,500 per-piece threshold', () => {
    const budget = suggestGstRate('6109', 999)!
    expect(budget.rate).toBe(5)
    expect(budget.basis).toContain('up to ₹2,500')
    const premium = suggestGstRate('6109', 2999)!
    expect(premium.rate).toBe(18)
    expect(premium.basis).toContain('above ₹2,500')
  })
  it('footwear follows the same ₹2,500 rule', () => {
    expect(suggestGstRate('6403', 1500)!.rate).toBe(5)
    expect(suggestGstRate('6403', 3500)!.rate).toBe(18)
  })
  it('without a price, threshold items suggest the base rate', () => {
    expect(suggestGstRate('6109')!.rate).toBe(5)
  })

  it('SAC codes resolve too', () => {
    expect(suggestGstRate('9963')!.rate).toBe(5) // restaurant service
    expect(suggestGstRate('9983')!.rate).toBe(18) // professional services
    expect(suggestGstRate('9987')!.rate).toBe(0) // education
  })

  it('returns null for unknown codes (never invents a rate)', () => {
    expect(suggestGstRate('9999')).toBeNull()
    expect(suggestGstRate('')).toBeNull()
  })
})
