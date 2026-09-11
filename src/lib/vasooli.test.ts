import { describe, expect, it } from 'vitest'
import {
  fillTemplate, prepareVasooliRound, vasooliSummary, vasooliTier,
  type VasooliDebt,
} from './vasooli'

const debts: VasooliDebt[] = [
  { customerId: 'c1', customerName: 'Ramesh', phone: '919999888877', amount: 600, daysOverdue: 3 },
  { customerId: 'c2', customerName: 'Sunita', phone: '918888777666', amount: 350, daysOverdue: 12 },
  { customerId: 'c3', customerName: 'Sharma ji', phone: '917777666555', amount: 5000, daysOverdue: 30 },
]

const opts = {
  shopName: 'Meow General Store',
  ownerName: 'Saif',
  upiId: 'meow@upi',
}

describe('vasooliTier — tone ladder by days overdue', () => {
  it('0-7 days is a soft nudge', () => {
    expect(vasooliTier(0)).toBe('soft')
    expect(vasooliTier(7)).toBe('soft')
  })
  it('8-20 days is neutral + factual', () => {
    expect(vasooliTier(8)).toBe('factual')
    expect(vasooliTier(20)).toBe('factual')
  })
  it('20+ is direct but respectful, signed by the owner', () => {
    expect(vasooliTier(21)).toBe('direct')
    expect(vasooliTier(90)).toBe('direct')
  })
  it('junk input never escalates', () => {
    expect(vasooliTier(-5)).toBe('soft')
    expect(vasooliTier(NaN)).toBe('soft')
  })
})

describe('prepareVasooliRound — prepare, show, confirm', () => {
  const drafts = prepareVasooliRound(debts, opts)

  it('drafts one message per debtor, biggest money first', () => {
    expect(drafts).toHaveLength(3)
    expect(drafts[0].customerName).toBe('Sharma ji')
  })

  it('tier and language land on each draft', () => {
    const byName = Object.fromEntries(drafts.map((d) => [d.customerName, d]))
    expect(byName.Ramesh.tier).toBe('soft')
    expect(byName.Sunita.tier).toBe('factual')
    expect(byName['Sharma ji'].tier).toBe('direct')
    expect(byName.Ramesh.language).toBe('hinglish') // default
  })

  it('every message carries the amount and a UPI deep-link', () => {
    for (const d of drafts) {
      expect(d.message).toContain('Rs. ')
      expect(d.upiLink).toMatch(/^upi:\/\/pay\?/)
      expect(d.message).toContain(d.upiLink)
    }
  })

  it('direct tier is signed with the owner name, soft never is', () => {
    const byName = Object.fromEntries(drafts.map((d) => [d.customerName, d]))
    expect(byName['Sharma ji'].message).toContain('Saif')
    expect(byName.Ramesh.message).not.toContain('Saif')
  })

  it('never uses exclamation marks — an employee, not a marketer', () => {
    for (const d of drafts) expect(d.message).not.toContain('!')
  })

  it('respects the manual override — "don\'t chase Sharma ji yet"', () => {
    const filtered = prepareVasooliRound(debts, { ...opts, skipCustomerIds: ['c3'] })
    expect(filtered.map((d) => d.customerId)).toEqual(['c1', 'c2'])
  })

  it('per-customer language, set once', () => {
    const langs = prepareVasooliRound(debts, {
      ...opts,
      languageFor: (id) => (id === 'c1' ? 'bhojpuri' : id === 'c2' ? 'hindi' : 'english'),
    })
    const byName = Object.fromEntries(langs.map((d) => [d.customerName, d]))
    expect(byName.Ramesh.message).toContain('बाकी') // Bhojpuri register
    expect(byName.Sunita.message).toContain('बाकी') // Hindi
    expect(byName['Sharma ji'].message).toContain('pending at Meow General Store')
  })

  it('drops debts without a phone or amount — never sends blind', () => {
    const junk = prepareVasooliRound([
      ...debts,
      { customerId: 'c4', customerName: 'NoPhone', phone: '', amount: 100, daysOverdue: 9 },
      { customerId: 'c5', customerName: 'Zero', phone: '911234567890', amount: 0, daysOverdue: 9 },
    ], opts)
    expect(junk).toHaveLength(3)
  })
})

describe('fillTemplate + summary', () => {
  it('fills only known slots', () => {
    expect(fillTemplate('{{name}} owes {{amount}}', { name: 'A', amount: 'Rs. 10' })).toBe('A owes Rs. 10')
  })
  it('summary counts and totals', () => {
    const drafts = prepareVasooliRound(debts, opts)
    expect(vasooliSummary(drafts, 1)).toBe('3 messages ready · 1 skipped · Rs. 5,950 total')
  })
})
