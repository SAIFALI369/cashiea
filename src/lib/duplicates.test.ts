import { describe, it, expect } from 'vitest'
import {
  levenshtein, similarity, normalizeName, normalizePhone,
  findCustomerDuplicates, findProductDuplicates, pickKeeper, missingContactFields,
} from './duplicates'

describe('levenshtein / similarity', () => {
  it('identical strings are distance 0 / similarity 1', () => {
    expect(levenshtein('ramesh', 'ramesh')).toBe(0)
    expect(similarity('ramesh', 'ramesh')).toBe(1)
  })
  it('one substitution is distance 1', () => {
    expect(levenshtein('ramesh', 'ramish')).toBe(1)
  })
  it('empty vs empty is identical; empty vs something is 0 similar', () => {
    expect(similarity('', '')).toBe(1)
    expect(similarity('ramesh', '')).toBe(0)
  })
})

describe('normalizeName / normalizePhone', () => {
  it('strips punctuation and collapses spaces', () => {
    expect(normalizeName('  Ramesh,  Kumar. ')).toBe('ramesh kumar')
  })
  it('keeps Devanagari letters', () => {
    expect(normalizeName('रमेश')).toBe('रमेश')
  })
  it('Indian phones → last 10 digits', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210')
    expect(normalizePhone('09876543210')).toBe('9876543210')
    expect(normalizePhone('12345')).toBeNull()
  })
})

describe('findCustomerDuplicates', () => {
  it('matches on the same 10-digit phone even with different formatting', () => {
    const pairs = findCustomerDuplicates([
      { id: 'a', name: 'Ramesh', phone: '+91 98765 43210' },
      { id: 'b', name: 'R. Kumar', phone: '09876543210' },
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0].reason).toBe('phone')
  })

  it('matches on email case-insensitively', () => {
    const pairs = findCustomerDuplicates([
      { id: 'a', name: 'A', email: 'Asha@Gmail.com' },
      { id: 'b', name: 'B', email: 'asha@gmail.com' },
    ])
    expect(pairs[0].reason).toBe('email')
  })

  it('fuzzy-matches near-identical names', () => {
    const pairs = findCustomerDuplicates([
      { id: 'a', name: 'Ramesh Kumar' },
      { id: 'b', name: 'Ramesh Kumar.' },
    ])
    expect(pairs.some((p) => p.reason === 'name')).toBe(true)
  })

  it('does not flag unrelated names', () => {
    const pairs = findCustomerDuplicates([
      { id: 'a', name: 'Ramesh Kumar' },
      { id: 'b', name: 'Priya Sharma' },
    ])
    expect(pairs).toHaveLength(0)
  })
})

describe('findProductDuplicates', () => {
  it('matches on SKU regardless of case', () => {
    const pairs = findProductDuplicates([
      { id: 'a', name: 'Cement 50kg', sku: 'CEM-50' },
      { id: 'b', name: 'Cement bag', sku: 'cem-50' },
    ])
    expect(pairs[0].reason).toBe('sku')
  })

  it('flags near-identical product names', () => {
    const pairs = findProductDuplicates([
      { id: 'a', name: 'Basmati Rice 5kg' },
      { id: 'b', name: 'Basmati Rice 5 kg' },
    ])
    expect(pairs.some((p) => p.reason === 'name')).toBe(true)
  })
})

describe('pickKeeper / missingContactFields', () => {
  it('keeps the card with more orders', () => {
    const { keeper, extra } = pickKeeper(
      { id: 'a', name: 'A', total_orders: 1, total_spent: 9000 },
      { id: 'b', name: 'B', total_orders: 4, total_spent: 100 },
    )
    expect(keeper.id).toBe('b')
    expect(extra.id).toBe('a')
  })

  it('copies only fields the keeper is missing', () => {
    const patch = missingContactFields(
      { phone: '9876543210', email: null, address: '', company: 'Keep Co' },
      { phone: '111', email: 'x@y.com', address: 'Lane 1', company: 'Other Co', notes: 'VIP' },
    )
    expect(patch).toEqual({ email: 'x@y.com', address: 'Lane 1', notes: 'VIP' })
    expect(patch.phone).toBeUndefined()
    expect(patch.company).toBeUndefined()
  })
})
