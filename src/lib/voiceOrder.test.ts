import { describe, it, expect } from 'vitest'
import { parseVoiceOrder, matchProduct } from './voiceOrder'

describe('parseVoiceOrder', () => {
  it('reads the brief\'s example', () => {
    expect(parseVoiceOrder('Add 2 Aashirvaad Atta to cart')).toEqual({ quantity: 2, query: 'aashirvaad atta' })
  })

  it('defaults to one when no quantity is spoken', () => {
    expect(parseVoiceOrder('add tata salt')).toEqual({ quantity: 1, query: 'tata salt' })
  })

  it('understands spoken number words', () => {
    expect(parseVoiceOrder('add three parle g')?.quantity).toBe(3)
    expect(parseVoiceOrder('add a coke')?.quantity).toBe(1)
    expect(parseVoiceOrder('dozen eggs')?.quantity).toBe(12)
  })

  it('understands Hindi numerals a shopkeeper would use', () => {
    expect(parseVoiceOrder('do packet atta')?.quantity).toBe(2)
    expect(parseVoiceOrder('paanch kg chawal')?.quantity).toBe(5)
  })

  it('keeps numbers that belong to the product name', () => {
    // The 5 in "Atta 5kg" is part of the product, not a second quantity.
    const r = parseVoiceOrder('add 2 aashirvaad atta 5kg')
    expect(r?.quantity).toBe(2)
    expect(r?.query).toContain('5kg')
  })

  it('does not treat a mid-sentence "do" as Hindi two', () => {
    // "do" here is English filler; the quantity must stay 1.
    expect(parseVoiceOrder('add atta do')?.quantity).toBe(1)
  })

  it('strips filler words but keeps the product', () => {
    expect(parseVoiceOrder('please add the coca cola to my bill')?.query).toBe('coca cola')
  })

  it('returns null when nothing usable was said', () => {
    expect(parseVoiceOrder('add to cart')).toBeNull()
    expect(parseVoiceOrder('')).toBeNull()
    expect(parseVoiceOrder('   ')).toBeNull()
  })

  it('ignores punctuation from the recogniser', () => {
    expect(parseVoiceOrder('Add 2 Aashirvaad Atta, to cart.')).toEqual({ quantity: 2, query: 'aashirvaad atta' })
  })
})

describe('matchProduct', () => {
  const products = [
    { name: 'Aashirvaad Atta 5kg', sku: 'ATT5' },
    { name: 'Tata Salt 1kg', sku: 'SALT1' },
    { name: 'Fortune Oil 5L', sku: 'OIL5' },
    { name: 'Parle-G 800g', sku: 'PG800' },
  ]

  it('finds an exact name', () => {
    expect(matchProduct('tata salt 1kg', products)?.sku).toBe('SALT1')
  })

  it('finds a partial name', () => {
    expect(matchProduct('aashirvaad atta', products)?.sku).toBe('ATT5')
  })

  it('matches on SKU', () => {
    expect(matchProduct('oil5', products)?.sku).toBe('OIL5')
  })

  it('matches when the words are all present', () => {
    expect(matchProduct('parle g', products)?.sku).toBe('PG800')
  })

  it('returns null rather than guessing on a weak match', () => {
    expect(matchProduct('helicopter', products)).toBeNull()
  })

  it('refuses to choose between identically-named products', () => {
    // Two products that score the same must NOT be silently resolved —
    // charging for the wrong one is worse than asking again.
    const ambiguous = [{ name: 'Red Pen', sku: 'A' }, { name: 'Red Pen', sku: 'B' }]
    expect(matchProduct('red pen', ambiguous)).toBeNull()
  })

  it('prefers the shorter name on a near tie', () => {
    const list = [{ name: 'Atta', sku: 'SHORT' }, { name: 'Atta Container Lid Large', sku: 'LONG' }]
    expect(matchProduct('atta', list)?.sku).toBe('SHORT')
  })

  it('handles an empty catalogue and empty query', () => {
    expect(matchProduct('atta', [])).toBeNull()
    expect(matchProduct('', products)).toBeNull()
  })
})
