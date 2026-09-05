import { describe, it, expect } from 'vitest'
import { parseDocLines, computeDocTotals, quoteTotals, clampTaxRate } from './quoteMath'
import { round2 } from './pos'

describe('parseDocLines — only complete, sane lines survive', () => {
  it('keeps normal rows and parses numeric strings', () => {
    expect(parseDocLines([
      { description: 'Wire 2m', quantity: '3', unit_price: '33.33' },
      { description: 'Installation', quantity: 1, unit_price: 0 },
    ])).toEqual([
      { description: 'Wire 2m', quantity: 3, unit_price: 33.33 },
      { description: 'Installation', quantity: 1, unit_price: 0 },
    ])
  })

  it('drops rows with no description (even if they have amounts)', () => {
    const lines = parseDocLines([{ description: '   ', quantity: 5, unit_price: 100 }])
    expect(lines).toHaveLength(0)
  })

  it('drops rows with zero, negative or NaN quantity', () => {
    expect(parseDocLines([
      { description: 'A', quantity: 0, unit_price: 10 },
      { description: 'B', quantity: -2, unit_price: 10 },
      { description: 'C', quantity: 'abc', unit_price: 10 },
    ])).toHaveLength(0)
  })

  it('drops rows with negative or NaN price', () => {
    expect(parseDocLines([
      { description: 'A', quantity: 1, unit_price: -50 },
      { description: 'B', quantity: 1, unit_price: 'oops' },
    ])).toHaveLength(0)
  })
})

describe('clampTaxRate', () => {
  it('clamps to 0–100', () => {
    expect(clampTaxRate(18)).toBe(18)
    expect(clampTaxRate('12')).toBe(12)
    expect(clampTaxRate(150)).toBe(100)
    expect(clampTaxRate(-5)).toBe(0)
    expect(clampTaxRate(Number.NaN)).toBe(0)
    expect(clampTaxRate(null)).toBe(0)
    expect(clampTaxRate(undefined)).toBe(0)
  })
})

describe('computeDocTotals — rounded, self-consistent money', () => {
  it('rounds to the paisa instead of storing float dust', () => {
    const t = computeDocTotals([{ description: 'Item', quantity: 3, unit_price: 0.1 }], 0)
    expect(t.subtotal).toBe(0.3) // NOT 0.30000000000000004
  })

  it('tax is computed on the rounded subtotal and rounded itself', () => {
    const t = computeDocTotals([{ description: 'Wire', quantity: 3, unit_price: 33.33 }], 18)
    expect(t.subtotal).toBe(99.99)
    expect(t.taxAmount).toBe(18) // round2(17.9982)
    expect(t.total).toBe(117.99)
  })

  it('the stored equation always holds exactly: subtotal + tax = total', () => {
    const t = computeDocTotals([
      { description: 'A', quantity: 2.5, unit_price: 199.99 },
      { description: 'B', quantity: 7, unit_price: 12.35 },
    ], 28)
    // Exact float equality is impossible in JS (586.42 + 164.2 = 750.62999…);
    // the guarantee is that the parts sum to the stored total to the paisa.
    expect(round2(t.subtotal + t.taxAmount)).toBe(t.total)
  })

  it('totals match the sum of the lines that will actually be saved', () => {
    // The old bug: totals summed every form row, invalid rows were dropped
    // from the saved items — numbers disagreed.
    const t = quoteTotals([
      { description: 'Real item', quantity: 2, unit_price: 50 },
      { description: '', quantity: 10, unit_price: 500 }, // dropped
      { description: 'Bad qty', quantity: 'x', unit_price: 500 }, // dropped
    ], 18)
    expect(t.lines).toHaveLength(1)
    expect(t.subtotal).toBe(100)
    expect(t.total).toBe(118)
  })

  it('handles the empty case without NaN', () => {
    const t = quoteTotals([], 18)
    expect(t).toEqual({ lines: [], subtotal: 0, taxRate: 18, taxAmount: 0, total: 0 })
  })
})
