import { describe, it, expect } from 'vitest'
import {
  evaluatePromotions, isPromotionActive, lineMatchesBogo, bogoDiscountUnits,
  validatePromotion, promotionLabel,
  type Promotion, type PromoLine, type ProductLike,
} from './promotions'

const NOW = new Date('2026-09-14T12:00:00').getTime()

function rule(over: Partial<Promotion>): Promotion {
  return {
    id: over.id || 'p1',
    name: over.name || 'Deal',
    kind: over.kind || 'percent',
    config: over.config || {},
    starts_at: over.starts_at ?? null,
    ends_at: over.ends_at ?? null,
    enabled: over.enabled ?? true,
  }
}

const soap = { key: 'k1', product_id: 'prod-1', name: 'Soap', quantity: 6, unit_price: 50 }
const lines = (ls: PromoLine[]) => ls
const products: ProductLike[] = [
  { id: 'prod-1', category: 'personal care' },
  { id: 'prod-2', category: 'snacks' },
]

describe('isPromotionActive', () => {
  it('respects enabled + the date window (ends inclusive)', () => {
    expect(isPromotionActive(rule({}), NOW)).toBe(true)
    expect(isPromotionActive(rule({ enabled: false }), NOW)).toBe(false)
    expect(isPromotionActive(rule({ starts_at: '2026-09-15' }), NOW)).toBe(false)
    expect(isPromotionActive(rule({ starts_at: '2026-09-14' }), NOW)).toBe(true)
    expect(isPromotionActive(rule({ ends_at: '2026-09-14' }), NOW)).toBe(true)
    expect(isPromotionActive(rule({ ends_at: '2026-09-13' }), NOW)).toBe(false)
    // The deal runs through the END of its end day.
    const endOfDay = new Date('2026-09-14T23:30:00').getTime()
    expect(isPromotionActive(rule({ ends_at: '2026-09-14' }), endOfDay)).toBe(true)
  })
})

describe('bogoDiscountUnits', () => {
  it('buy 2 get 1 on 6 units → 2 free', () => {
    expect(bogoDiscountUnits(6, 2, 1)).toBe(2)
  })
  it('partial groups do not qualify', () => {
    expect(bogoDiscountUnits(5, 2, 1)).toBe(1)
    expect(bogoDiscountUnits(2, 2, 1)).toBe(0)
  })
  it('buy 1 get 1 on 3 units → 1 free', () => {
    expect(bogoDiscountUnits(3, 1, 1)).toBe(1)
  })
  it('never returns negatives', () => {
    expect(bogoDiscountUnits(-4, 2, 1)).toBe(0)
    expect(bogoDiscountUnits(4, 2, 0)).toBe(0)
  })
})

describe('lineMatchesBogo', () => {
  const line = { key: 'k', product_id: 'prod-1', name: 'Soap', quantity: 1, unit_price: 10 }
  it('matches by product id', () => {
    expect(lineMatchesBogo(line, products[0], { productId: 'prod-1', buy: 2, get: 1, discountPct: 100 })).toBe(true)
    expect(lineMatchesBogo(line, products[0], { productId: 'other', buy: 2, get: 1, discountPct: 100 })).toBe(false)
  })
  it('matches by category (case-insensitive)', () => {
    expect(lineMatchesBogo(line, products[0], { category: 'Personal Care', buy: 2, get: 1, discountPct: 100 })).toBe(true)
    expect(lineMatchesBogo(line, products[0], { category: 'snacks', buy: 2, get: 1, discountPct: 100 })).toBe(false)
  })
  it('no target = no match (safety)', () => {
    expect(lineMatchesBogo(line, products[0], { buy: 2, get: 1, discountPct: 100 })).toBe(false)
  })
})

describe('evaluatePromotions — BOGO', () => {
  const bogo = rule({
    id: 'b1', name: 'Soap BOGO', kind: 'bogo',
    config: { productId: 'prod-1', buy: 2, get: 1, discountPct: 100 },
  })

  it('discounts the free units on a full cart line', () => {
    const r = evaluatePromotions([bogo], lines([soap]), products, NOW)
    expect(r.lineDiscounts).toEqual([{ lineKey: 'k1', amount: 100, ruleId: 'b1', ruleName: 'Soap BOGO' }])
    expect(r.totalDiscount).toBe(100)
    expect(r.labels).toEqual(['Soap BOGO'])
  })

  it('applies a partial discount when discountPct < 100', () => {
    const half = rule({ kind: 'bogo', config: { productId: 'prod-1', buy: 2, get: 1, discountPct: 50 } })
    const r = evaluatePromotions([half], lines([{ ...soap, quantity: 3 }]), products, NOW)
    expect(r.lineDiscounts[0].amount).toBe(25)
  })

  it('does not apply outside the scheduled window', () => {
    const expired = rule({ kind: 'bogo', config: { productId: 'prod-1', buy: 2, get: 1, discountPct: 100 }, ends_at: '2026-01-01' })
    const r = evaluatePromotions([expired], lines([soap]), products, NOW)
    expect(r.totalDiscount).toBe(0)
  })

  it('one line takes at most one BOGO (the best)', () => {
    const weaker = rule({ id: 'w', name: 'Weak', kind: 'bogo', config: { category: 'personal care', buy: 5, get: 1, discountPct: 100 } })
    const r = evaluatePromotions([weaker, bogo], lines([soap]), products, NOW)
    expect(r.lineDiscounts).toHaveLength(1)
    expect(r.lineDiscounts[0].ruleId).toBe('b1')
  })

  it('category BOGO hits every matching line', () => {
    const catBogo = rule({ kind: 'bogo', config: { category: 'personal care', buy: 1, get: 1, discountPct: 100 } })
    const r = evaluatePromotions([catBogo], lines([
      soap,
      { key: 'k2', product_id: 'prod-1', name: 'Soap', quantity: 2, unit_price: 50 },
    ]), products, NOW)
    expect(r.lineDiscounts).toHaveLength(2)
    expect(r.totalDiscount).toBe(200)
  })
})

describe('evaluatePromotions — cart deals never stack', () => {
  it('tiered picks the highest matching tier', () => {
    const tiered = rule({
      kind: 'tiered',
      config: { tiers: [{ minSpend: 500, pct: 5 }, { minSpend: 2000, pct: 10 }] },
    })
    const r = evaluatePromotions([tiered], lines([{ ...soap, quantity: 50, unit_price: 50 }]), products, NOW) // ₹2500
    expect(r.cartDiscount?.amount).toBe(250)
  })
  it('tiered below every threshold gives nothing', () => {
    const tiered = rule({ kind: 'tiered', config: { tiers: [{ minSpend: 5000, pct: 10 }] } })
    const r = evaluatePromotions([tiered], lines([soap]), products, NOW)
    expect(r.cartDiscount).toBeNull()
  })
  it('percent applies with an optional cap', () => {
    const pct = rule({ kind: 'percent', config: { pct: 10, maxDiscount: 20 } })
    const r = evaluatePromotions([pct], lines([soap]), products, NOW) // ₹300 spend
    expect(r.cartDiscount?.amount).toBe(20)
  })
  it('exactly ONE cart deal applies — the best value wins', () => {
    const five = rule({ id: 'five', name: '5% off', kind: 'percent', config: { pct: 5 } })
    const ten = rule({ id: 'ten', name: '10% off', kind: 'percent', config: { pct: 10 } })
    const r = evaluatePromotions([five, ten], lines([soap]), products, NOW)
    expect(r.cartDiscount?.ruleId).toBe('ten')
    expect(r.cartDiscount?.amount).toBe(30)
  })
})

describe('evaluatePromotions — caps and safety', () => {
  it('total discount can never exceed the cart value', () => {
    const everything = rule({ kind: 'percent', config: { pct: 100 } })
    const bogo = rule({ kind: 'bogo', config: { productId: 'prod-1', buy: 1, get: 1, discountPct: 100 } })
    const r = evaluatePromotions([everything, bogo], lines([soap]), products, NOW)
    expect(r.totalDiscount).toBeLessThanOrEqual(300)
    expect(r.totalDiscount).toBe(300)
  })
  it('negative quantities and prices are ignored', () => {
    const pct = rule({ kind: 'percent', config: { pct: 10 } })
    const r = evaluatePromotions([pct], lines([
      { key: 'k', product_id: 'x', name: 'Bad', quantity: -5, unit_price: 100 },
      { key: 'k2', product_id: 'x', name: 'Bad', quantity: 2, unit_price: -100 },
    ]), products, NOW)
    expect(r.totalDiscount).toBe(0)
  })
  it('empty cart is fine', () => {
    expect(evaluatePromotions([rule({ kind: 'percent', config: { pct: 10 } })], [], products, NOW).totalDiscount).toBe(0)
  })
})

describe('validatePromotion', () => {
  it('rejects a nameless rule', () => {
    expect(validatePromotion(rule({ name: '  ' })).ok).toBe(false)
  })
  it('rejects an inverted date window', () => {
    expect(validatePromotion(rule({ starts_at: '2026-10-10', ends_at: '2026-10-01' })).ok).toBe(false)
  })
  it('BOGO needs a target and sane numbers', () => {
    expect(validatePromotion(rule({ kind: 'bogo', config: { buy: 2, get: 1, discountPct: 100 } })).ok).toBe(false)
    expect(validatePromotion(rule({ kind: 'bogo', config: { productId: 'p', buy: 0, get: 1, discountPct: 100 } })).ok).toBe(false)
    expect(validatePromotion(rule({ kind: 'bogo', config: { productId: 'p', buy: 2, get: 0, discountPct: 100 } })).ok).toBe(false)
    expect(validatePromotion(rule({ kind: 'bogo', config: { productId: 'p', buy: 2, get: 1, discountPct: 0 } })).ok).toBe(false)
    expect(validatePromotion(rule({ kind: 'bogo', config: { productId: 'p', buy: 2, get: 1, discountPct: 100 } })).ok).toBe(true)
  })
  it('tiered needs tiers with positive spend and pct', () => {
    expect(validatePromotion(rule({ kind: 'tiered', config: {} })).ok).toBe(false)
    expect(validatePromotion(rule({ kind: 'tiered', config: { tiers: [{ minSpend: 0, pct: 5 }] } })).ok).toBe(false)
    expect(validatePromotion(rule({ kind: 'tiered', config: { tiers: [{ minSpend: 500, pct: 5 }] } })).ok).toBe(true)
  })
  it('percent needs a positive pct', () => {
    expect(validatePromotion(rule({ kind: 'percent', config: { pct: 0 } })).ok).toBe(false)
    expect(validatePromotion(rule({ kind: 'percent', config: { pct: 10, maxDiscount: -5 } })).ok).toBe(false)
    expect(validatePromotion(rule({ kind: 'percent', config: { pct: 10 } })).ok).toBe(true)
  })
})

describe('promotionLabel', () => {
  it('renders customer-facing labels', () => {
    expect(promotionLabel(rule({ name: 'Diwali', kind: 'bogo', config: { buy: 2, get: 1 } }))).toBe('Buy 2 Get 1 · Diwali')
    expect(promotionLabel(rule({ name: 'Save big', kind: 'tiered', config: {} }))).toBe('Spend & save · Save big')
    expect(promotionLabel(rule({ name: 'Flat', kind: 'percent', config: { pct: 15 } }))).toBe('15% off · Flat')
  })
})
