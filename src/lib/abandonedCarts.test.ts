import { describe, it, expect } from 'vitest'
import { findAbandonedCarts, formatAge, draftCartReminder, cartReminderLink } from './abandonedCarts'
import type { HeldCart } from './types'

const NOW = new Date('2026-09-14T15:00:00').getTime()

function cart(over: Partial<HeldCart> & { created_at: string }): HeldCart {
  return {
    id: over.id || 'c1',
    user_id: 'u1',
    label: over.label ?? null,
    cart: over.cart ?? { lines: [{ quantity: 3 }, { quantity: 2 }], customer: null },
    total: over.total ?? 1500,
    created_at: over.created_at,
    updated_at: over.created_at,
  }
}

const hoursAgo = (h: number) => new Date(NOW - h * 3600000).toISOString()

describe('findAbandonedCarts', () => {
  it('finds a valuable cart aged into the window', () => {
    const found = findAbandonedCarts([cart({ created_at: hoursAgo(3) })], NOW)
    expect(found).toHaveLength(1)
    expect(found[0].total).toBe(1500)
    expect(found[0].itemCount).toBe(5)
    expect(found[0].ageHours).toBe(3)
  })

  it('ignores fresh carts (customer may still be shopping)', () => {
    expect(findAbandonedCarts([cart({ created_at: hoursAgo(1) })], NOW)).toHaveLength(0)
  })

  it('ignores stale carts past the window (the moment has passed)', () => {
    expect(findAbandonedCarts([cart({ created_at: hoursAgo(96) })], NOW)).toHaveLength(0)
  })

  it('ignores trivial carts below the minimum value', () => {
    expect(findAbandonedCarts([cart({ created_at: hoursAgo(3), total: 50 })], NOW)).toHaveLength(0)
  })

  it('respects custom thresholds', () => {
    expect(findAbandonedCarts([cart({ created_at: hoursAgo(1), total: 50 })], NOW, { minAgeHours: 0.5, minValue: 10 })).toHaveLength(1)
  })

  it('extracts the customer from the snapshot', () => {
    const found = findAbandonedCarts([cart({
      created_at: hoursAgo(4),
      label: "Ramesh's cart",
      cart: { lines: [{ quantity: 1 }], customer: { name: 'Ramesh Kumar' } },
    })], NOW)
    expect(found[0].customerName).toBe('Ramesh Kumar')
    expect(found[0].label).toBe("Ramesh's cart")
  })

  it('falls back to the label as the display name', () => {
    const found = findAbandonedCarts([cart({ created_at: hoursAgo(4), label: 'Sita — evening pickup' })], NOW)
    expect(found[0].label).toBe('Sita — evening pickup')
    expect(found[0].customerName).toBeNull()
  })

  it('sorts by value, biggest first', () => {
    const found = findAbandonedCarts([
      cart({ id: 'small', created_at: hoursAgo(3), total: 400 }),
      cart({ id: 'big', created_at: hoursAgo(5), total: 4000 }),
    ], NOW)
    expect(found[0].id).toBe('big')
  })

  it('skips rows with unparseable dates', () => {
    expect(findAbandonedCarts([cart({ created_at: 'garbage' })], NOW)).toHaveLength(0)
  })
})

describe('formatAge', () => {
  it('renders friendly ages', () => {
    expect(formatAge(0.2)).toBe('just now')
    expect(formatAge(2)).toBe('2 hours ago')
    expect(formatAge(1)).toBe('1 hour ago')
    expect(formatAge(3.5)).toBe('3.5 hours ago')
    expect(formatAge(26)).toBe('1 day ago')
    expect(formatAge(72)).toBe('3 days ago')
  })
})

describe('draftCartReminder + cartReminderLink', () => {
  const found = findAbandonedCarts([cart({
    created_at: hoursAgo(4),
    label: "Ramesh's cart",
    cart: { lines: [{ quantity: 2 }], customer: { name: 'Ramesh' } },
  })], NOW)[0]

  it('drafts a friendly, single-nudge message', () => {
    const msg = draftCartReminder(found, 'Sharma General Store')
    expect(msg).toContain('Hi Ramesh!')
    expect(msg).toContain('Sharma General Store')
    expect(msg).toContain('₹1,500')
    expect(msg).toContain('2 items')
    // One nudge, never pushy language.
    expect(msg).not.toMatch(/urgent|last chance|immediately/i)
  })

  it('builds a wa.me link for a 10-digit Indian number', () => {
    const withPhone = { ...found, customerPhone: '98765 43210' }
    const link = cartReminderLink(withPhone, 'Shop')
    expect(link).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/)
  })

  it('handles numbers already carrying the country code', () => {
    const link = cartReminderLink({ ...found, customerPhone: '+91 9876543210' }, 'Shop')
    expect(link).toContain('wa.me/919876543210')
  })

  it('returns null without a usable phone', () => {
    expect(cartReminderLink({ ...found, customerPhone: null }, 'Shop')).toBeNull()
    expect(cartReminderLink({ ...found, customerPhone: '123' }, 'Shop')).toBeNull()
  })
})
