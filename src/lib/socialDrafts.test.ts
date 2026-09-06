import { describe, it, expect } from 'vitest'
import { buildSocialDrafts } from './socialDrafts'

describe('buildSocialDrafts', () => {
  it('does not invent bills on a quiet day', () => {
    const d = buildSocialDrafts({ shopName: 'Gupta Store', sales: 0, bills: 0, today: new Date(2026, 8, 6) })
    expect(d[0].id).toBe('quiet')
    expect(d[0].caption).toMatch(/Gupta Store/)
    expect(d.some((x) => /₹/.test(x.caption) && x.id === 'today')).toBe(false)
  })

  it('names the top item when there were bills', () => {
    const d = buildSocialDrafts({
      shopName: 'Gupta Store', sales: 12400, bills: 11,
      topItem: { name: 'Cement 50kg', qty: 8 },
      today: new Date(2026, 8, 6),
    })
    const today = d.find((x) => x.id === 'today')!
    expect(today.caption).toMatch(/11 bills/)
    expect(today.caption).toMatch(/Cement 50kg/)
    expect(d.some((x) => x.id === 'highlight')).toBe(true)
  })

  it('never puts profit in a public caption even when passed', () => {
    const d = buildSocialDrafts({
      shopName: 'X', sales: 1000, bills: 2, profit: 400,
      today: new Date(2026, 8, 6),
    })
    expect(d.every((x) => !/400/.test(x.caption))).toBe(true)
  })

  it('adds a festival line when one is within 7 days', () => {
    // Ganesh Chaturthi 2026-09-14; 7 Sep is 7 days out
    const d = buildSocialDrafts({ shopName: 'X', sales: 0, bills: 0, today: new Date(2026, 8, 7) })
    expect(d.some((x) => x.title.includes('Ganesh'))).toBe(true)
  })
})
