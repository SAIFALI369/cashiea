import { describe, it, expect } from 'vitest'
import { nextDocNumber } from './docnum'

const DAY = new Date(2026, 8, 6, 10, 30, 0) // 6 Sep 2026 (local time)

describe('nextDocNumber', () => {
  it('formats as PREFIX-YYMMDD-NNNN', () => {
    expect(nextDocNumber('INV', { now: DAY, rand: () => 0.42 })).toBe('INV-260906-4200')
    expect(nextDocNumber('QT', { now: DAY, rand: () => 0 })).toBe('QT-260906-0000')
    expect(nextDocNumber('INV', { now: DAY, rand: () => 0.9999 })).toBe('INV-260906-9999')
  })

  it('pads month and day to two digits', () => {
    const newYear = new Date(2027, 0, 3)
    expect(nextDocNumber('INV', { now: newYear, rand: () => 0.5 })).toBe('INV-270103-5000')
  })

  it('numbers from different days never collide (the old scheme repeated every ~16.7 minutes)', () => {
    // The old `Date.now().toString().slice(-6)` produced the SAME number
    // for any two moments exactly 1,000,000 ms apart. The date prefix
    // makes that impossible; the random suffix separates same-day draws.
    const a = new Date(2026, 8, 6, 23, 50, 0)
    const b = new Date(2026, 8, 7, 0, 6, 40) // 16.7 minutes later, next day
    const rand = () => 0.1234
    expect(nextDocNumber('INV', { now: a, rand })).not.toBe(nextDocNumber('INV', { now: b, rand }))
  })

  it('different random draws give different numbers on the same day', () => {
    const nums = new Set(
      Array.from({ length: 200 }, (_, i) => nextDocNumber('INV', { now: DAY, rand: () => i / 200 })),
    )
    expect(nums.size).toBe(200)
  })
})
