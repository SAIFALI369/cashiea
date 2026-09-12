import { describe, expect, it } from 'vitest'
import { NAV_SYNONYMS, countNav, filterNav, scoreNavItem } from './navSearch'

const ITEMS = [
  { to: '/app/customers', label: 'Customers' },
  { to: '/app/pos', label: 'New Sale' },
  { to: '/app/products', label: 'Products' },
  { to: '/app/khata', label: 'Khata' },
]

describe('scoreNavItem — literal beats synonym, always', () => {
  it('100 exact label', () => {
    expect(scoreNavItem({ to: '/x', label: 'Khata' }, 'khata')).toBe(100)
  })
  it('80 label starts-with', () => {
    expect(scoreNavItem({ to: '/x', label: 'Khata book' }, 'kha')).toBe(80)
  })
  it('60 label contains', () => {
    expect(scoreNavItem({ to: '/x', label: 'New Sale' }, 'sale')).toBe(60)
  })
  it('50 all query words present (non-contiguous)', () => {
    expect(scoreNavItem({ to: '/x', label: 'Sale of Counter items' }, 'counter sale')).toBe(50)
  })
  it('40 synonym starts-with beats 30 synonym contains', () => {
    expect(scoreNavItem({ to: '/app/customers', label: 'Customers' }, 'udh')).toBe(40)
    expect(scoreNavItem({ to: '/app/customers', label: 'Customers' }, 'dhaar')).toBe(30)
  })
  it('a literal label match outranks a synonym match', () => {
    const literal = scoreNavItem({ to: '/app/khata', label: 'Khata' }, 'khata')
    const synonym = scoreNavItem({ to: '/app/customers', label: 'Customers' }, 'khata')
    expect(literal).toBeGreaterThan(synonym)
  })
  it('no match is 0', () => {
    expect(scoreNavItem({ to: '/x', label: 'Reports' }, 'zzz')).toBe(0)
  })
})

describe('filterNav — shopkeeper vocabulary', () => {
  it('udhaar finds Customers (not just Khata)', () => {
    const out = filterNav(ITEMS, 'udhaar')
    expect(out.some((i) => i.to === '/app/customers')).toBe(true)
  })
  it('maal finds Products', () => {
    expect(filterNav(ITEMS, 'maal').some((i) => i.to === '/app/products')).toBe(true)
  })
  it('bill finds the POS counter', () => {
    expect(filterNav(ITEMS, 'bill').some((i) => i.to === '/app/pos')).toBe(true)
  })
  it('ranks higher scores first', () => {
    const out = filterNav(ITEMS, 'kha')
    const khata = out.findIndex((i) => i.to === '/app/khata')
    const customers = out.findIndex((i) => i.to === '/app/customers')
    expect(khata).toBeGreaterThanOrEqual(0)
    expect(khata).toBeLessThan(customers >= 0 ? customers : Infinity)
  })
  it('empty query returns the SAME array reference — the tree renders untouched', () => {
    const out = filterNav(ITEMS, '   ')
    expect(out).toBe(ITEMS)
  })
  it('unmatched items are dropped', () => {
    expect(filterNav(ITEMS, 'zyzzo')).toEqual([])
  })
})

describe('countNav', () => {
  const groups = [
    { items: ITEMS },
    { items: [{ to: '/app/reports', label: 'Reports' }] },
  ]
  it('counts everything on an empty query', () => {
    expect(countNav(groups, '')).toBe(5)
  })
  it('counts only matches while searching', () => {
    expect(countNav(groups, 'khata')).toBe(2) // Khata literal + Customers synonym
  })
  it('zero when nothing matches', () => {
    expect(countNav(groups, 'qqq')).toBe(0)
  })
})

describe('NAV_SYNONYMS routes exist', () => {
  it('every synonym route is a real /app/ path', () => {
    for (const route of Object.keys(NAV_SYNONYMS)) {
      expect(route.startsWith('/app/')).toBe(true)
    }
  })
})
