import { describe, it, expect } from 'vitest'
import { topCompanion, companionTip, MIN_TOGETHER, type BasketTxn } from './basketAffinity'

const basket = (...ids: string[]): BasketTxn => ({
  items: ids.map((id) => ({ product_id: id, name: id.toUpperCase(), quantity: 1 })),
})

describe('topCompanion', () => {
  it('finds the product most often bought alongside the anchor', () => {
    const txns = [basket('atta', 'oil'), basket('atta', 'oil'), basket('atta', 'oil'), basket('atta', 'salt')]
    const r = topCompanion(txns, 'atta')
    expect(r?.productId).toBe('oil')
    expect(r?.together).toBe(3)
    expect(r?.confidence).toBeCloseTo(0.75)
  })

  it('stays silent when the evidence is too thin', () => {
    // Only two shared baskets — below MIN_TOGETHER, so no claim is made.
    const txns = [basket('atta', 'oil'), basket('atta', 'oil')]
    expect(topCompanion(txns, 'atta')).toBeNull()
    expect(MIN_TOGETHER).toBeGreaterThan(2)
  })

  it('stays silent when confidence is low even with volume', () => {
    // Oil appears with atta 3 times but atta sells 100 times: 3% is not
    // "customers usually buy this together".
    const txns = [
      ...Array.from({ length: 97 }, () => basket('atta')),
      basket('atta', 'oil'), basket('atta', 'oil'), basket('atta', 'oil'),
    ]
    expect(topCompanion(txns, 'atta')).toBeNull()
  })

  it('counts a basket once however many units were bought', () => {
    const heavy: BasketTxn = {
      items: [
        { product_id: 'atta', name: 'Atta', quantity: 5 },
        { product_id: 'oil', name: 'Oil', quantity: 9 },
      ],
    }
    const r = topCompanion([heavy, heavy, heavy], 'atta')
    expect(r?.together).toBe(3)
    expect(r?.confidence).toBe(1)
  })

  it('ignores baskets without the anchor', () => {
    const txns = [basket('atta', 'oil'), basket('atta', 'oil'), basket('atta', 'oil'), basket('milk', 'bread')]
    const r = topCompanion(txns, 'atta')
    expect(r?.confidence).toBe(1)
  })

  it('handles empty, null and malformed input safely', () => {
    expect(topCompanion([], 'atta')).toBeNull()
    expect(topCompanion([{ items: null }], 'atta')).toBeNull()
    expect(topCompanion([basket('atta')], 'atta')).toBeNull()
    expect(topCompanion([basket('atta', 'oil')], '')).toBeNull()
  })

  it('never suggests the anchor itself', () => {
    const txns = Array.from({ length: 5 }, () => basket('atta', 'oil'))
    expect(topCompanion(txns, 'atta')?.productId).not.toBe('atta')
  })

  it('respects overridden thresholds', () => {
    const txns = [basket('atta', 'oil')]
    expect(topCompanion(txns, 'atta', { minTogether: 1, minConfidence: 0.1 })?.productId).toBe('oil')
  })
})

describe('companionTip', () => {
  it('reports the real percentage and never promises a discount', () => {
    const tip = companionTip('Atta', { productId: 'oil', name: 'Fortune Oil', together: 3, confidence: 0.75 })
    expect(tip).toContain('75%')
    expect(tip).toContain('Fortune Oil')
    expect(tip).not.toMatch(/%\s*off|discount|free/i)
  })
})
