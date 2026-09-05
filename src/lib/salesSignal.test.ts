import { describe, it, expect } from 'vitest'
import { salesSignal } from './salesSignal'

describe('salesSignal — zero sales is never a loss', () => {
  it('no sales today, busy yesterday → neutral, not bad (the reported bug)', () => {
    const s = salesSignal(0, 5000)
    expect(s.tone).toBe('neutral')
    expect(s.delta).toBeNull()
    expect(s.quiet).toBe(true)
  })

  it('no sales either day → neutral', () => {
    const s = salesSignal(0, 0)
    expect(s.tone).toBe('neutral')
    expect(s.quiet).toBe(true)
  })

  it('selling today with no sales yesterday → good (a % is not computable)', () => {
    const s = salesSignal(1200, 0)
    expect(s.tone).toBe('good')
    expect(s.delta).toBeNull()
    expect(s.quiet).toBe(false)
  })

  it('real slowdown → bad with an honest percentage', () => {
    expect(salesSignal(4000, 5000)).toEqual({ delta: -20, tone: 'bad', quiet: false })
  })

  it('growth → good with a percentage', () => {
    expect(salesSignal(6000, 5000)).toEqual({ delta: 20, tone: 'good', quiet: false })
  })

  it('flat sales → good at 0%', () => {
    expect(salesSignal(5000, 5000)).toEqual({ delta: 0, tone: 'good', quiet: false })
  })

  it('tolerates NaN inputs from bad rows', () => {
    expect(salesSignal(Number.NaN, 5000).tone).toBe('neutral')
    expect(salesSignal(5000, Number.NaN).tone).toBe('good')
  })
})
