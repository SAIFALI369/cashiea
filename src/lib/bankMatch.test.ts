import { describe, it, expect } from 'vitest'
import {
  parseAmount, parseBankDate, mapBankColumns, scorePair, matchBankTxns,
} from './bankMatch'

describe('parseAmount', () => {
  it.each([
    ['1234.50', 1234.5],
    ['₹1,234.50', 1234.5],
    ['1,23,456.78', 123456.78],
    ['Rs. 125', 125],
    ['Rs 1,234', 1234],
    ['(1,234)', -1234],
    ['500.00 Cr', 500],
    ['-250', -250],
  ])('parses %s', (raw, n) => {
    expect(parseAmount(raw as string)).toBe(n)
  })
  it('returns NaN on blank / junk', () => {
    expect(Number.isNaN(parseAmount(''))).toBe(true)
    expect(Number.isNaN(parseAmount('abc'))).toBe(true)
  })
})

describe('parseBankDate', () => {
  it('reads Indian dmy', () => {
    expect(parseBankDate('06/09/2026')).toBe('2026-09-06')
    expect(parseBankDate('6-9-26')).toBe('2026-09-06')
    expect(parseBankDate('06.09.2026')).toBe('2026-09-06')
  })
  it('reads ISO', () => expect(parseBankDate('2026-09-06')).toBe('2026-09-06'))
  it('returns empty on blank', () => expect(parseBankDate('')).toBe(''))
})

describe('mapBankColumns', () => {
  it('maps a typical SBI-style header row', () => {
    const m = mapBankColumns(['Value Date', 'Narration', 'Debit', 'Credit'])
    expect(m.date).toBe('Value Date')
    expect(m.description).toBe('Narration')
    expect(m.debit).toBe('Debit')
    expect(m.amount).toBe('Credit')
  })
  it('does not let Withdrawal Amount masquerade as the credit column', () => {
    const m = mapBankColumns(['Txn Date', 'Particulars', 'Withdrawal Amount', 'Deposit Amount'])
    expect(m.debit).toBe('Withdrawal Amount')
    expect(m.amount).toBe('Deposit Amount')
  })
})

const inv = (id: string, total: number, name: string, due?: string) => ({
  id, invoice_number: `INV-${id}`, client_name: name, total, due_date: due || null,
})

describe('scorePair', () => {
  it('returns 0 when the amount is nowhere close', () => {
    const s = scorePair(
      { date: '2026-09-06', description: 'UPI/RAJESH/1', amount: 5000 },
      inv('1', 120, 'Rajesh'),
    )
    expect(s.score).toBe(0)
  })
  it('gives a strong amount score for ±₹1', () => {
    const s = scorePair(
      { date: '2026-09-06', description: 'NEFT FOO', amount: 5000 },
      inv('1', 5000.5, 'Foo'),
    )
    expect(s.score).toBeGreaterThanOrEqual(70)
  })
})

describe('matchBankTxns', () => {
  it('auto-matches a unique exact amount as exact', () => {
    const out = matchBankTxns(
      [{ date: '2026-09-06', description: 'NEFT', amount: 5400 }],
      [inv('a', 5400, 'Rajesh Traders')],
    )
    expect(out[0].kind).toBe('exact')
    expect(out[0].invoiceId).toBe('a')
    expect(out[0].reason).toMatch(/amount matches/)
  })

  it('uses the name in a UPI narration to break a same-amount tie', () => {
    const out = matchBankTxns(
      [{ date: '2026-09-06', description: 'UPI/RAJESH KUMAR/12345', amount: 5000 }],
      [inv('r', 5000, 'Rajesh Kumar'), inv('a', 5000, 'Asha Stores')],
    )
    expect(out[0].invoiceId).toBe('r')
    expect(out[0].kind).toBe('exact')
    expect(out[0].reason).toMatch(/name in narration/)
  })

  it('does not auto-claim exact when two invoices share the amount and neither is named', () => {
    const out = matchBankTxns(
      [{ date: '2026-09-06', description: 'NEFT UNKNOWN', amount: 5000 }],
      [inv('a', 5000, 'Alpha'), inv('b', 5000, 'Beta')],
    )
    expect(out[0].kind).toBe('likely')
    expect(out[0].invoiceId).toBeTruthy()
  })

  it('uses each invoice at most once', () => {
    const out = matchBankTxns(
      [
        { date: '2026-09-06', description: 'A', amount: 1000 },
        { date: '2026-09-07', description: 'B', amount: 1000 },
      ],
      [inv('only', 1000, 'Someone')],
    )
    const matched = out.filter((m) => m.invoiceId)
    expect(matched).toHaveLength(1)
    expect(out.filter((m) => m.kind === 'none')).toHaveLength(1)
  })

  it('leaves a far-off credit unmatched', () => {
    const out = matchBankTxns(
      [{ date: '2026-09-06', description: 'UPI/RANDOM/9', amount: 87 }],
      [inv('a', 5000, 'Rajesh')],
    )
    expect(out[0].kind).toBe('none')
    expect(out[0].invoiceId).toBeNull()
  })

  it('does not invent a match from a similar name when the rupees disagree', () => {
    const out = matchBankTxns(
      [{ date: '2026-09-06', description: 'UPI/RAJESH KUMAR/1', amount: 50 }],
      [inv('a', 5000, 'Rajesh Kumar')],
    )
    expect(out[0].kind).toBe('none')
  })
})
