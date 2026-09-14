import { describe, it, expect } from 'vitest'
import {
  DEFAULT_LOYALTY_PROGRAM, tierForLifetimePoints, tierPerk, nextTier,
  pointsForSale, redeemValue, maxRedeemablePoints, checkRedemption,
  summariseLedger, sanitiseProgram,
} from './loyalty'

describe('tiers', () => {
  it('maps lifetime points to tiers at the thresholds', () => {
    expect(tierForLifetimePoints(0)).toBe('Bronze')
    expect(tierForLifetimePoints(999)).toBe('Bronze')
    expect(tierForLifetimePoints(1000)).toBe('Silver')
    expect(tierForLifetimePoints(4999)).toBe('Silver')
    expect(tierForLifetimePoints(5000)).toBe('Gold')
    expect(tierForLifetimePoints(20000)).toBe('Platinum')
  })
  it('tolerates garbage input', () => {
    expect(tierForLifetimePoints(-50)).toBe('Bronze')
    expect(tierForLifetimePoints(NaN)).toBe('Bronze')
  })
  it('every tier has a perk', () => {
    for (const t of ['Bronze', 'Silver', 'Gold', 'Platinum'] as const) {
      expect(tierPerk(t).length).toBeGreaterThan(5)
    }
  })
  it('knows the next tier and remaining points', () => {
    expect(nextTier(0)).toEqual({ tier: 'Silver', pointsRemaining: 1000 })
    expect(nextTier(1500)).toEqual({ tier: 'Gold', pointsRemaining: 3500 })
    expect(nextTier(25000)).toBeNull()
  })
})

describe('pointsForSale — mirrors the SQL trigger', () => {
  it('earns floor(total/100 × rate)', () => {
    expect(pointsForSale(100, { points_per_100: 1 })).toBe(1)
    expect(pointsForSale(999, { points_per_100: 1 })).toBe(9)
    expect(pointsForSale(2500, { points_per_100: 2 })).toBe(50)
    expect(pointsForSale(99, { points_per_100: 1 })).toBe(0)
  })
  it('never goes negative', () => {
    expect(pointsForSale(-500, { points_per_100: 1 })).toBe(0)
    expect(pointsForSale(500, { points_per_100: -3 })).toBe(0)
  })
})

describe('redeemValue', () => {
  it('multiplies points by the point value, 2-dp', () => {
    expect(redeemValue(100, { point_value: 0.5 })).toBe(50)
    expect(redeemValue(33, { point_value: 0.33 })).toBe(10.89)
    expect(redeemValue(0, { point_value: 1 })).toBe(0)
  })
})

describe('redemption rules (client mirror of the RPC)', () => {
  const program = { ...DEFAULT_LOYALTY_PROGRAM, enabled: true }

  it('requires the program to be enabled', () => {
    expect(checkRedemption(50, 100, { ...program, enabled: false }).ok).toBe(false)
  })
  it('enforces the minimum redemption', () => {
    const r = checkRedemption(10, 100, program)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Minimum')
  })
  it('rejects more points than the balance', () => {
    const r = checkRedemption(500, 100, program)
    expect(r.ok).toBe(false)
    expect(r.error).toContain('Only 100')
  })
  it('accepts a valid redemption', () => {
    expect(checkRedemption(50, 100, program).ok).toBe(true)
  })
  it('maxRedeemablePoints is zero below the minimum', () => {
    expect(maxRedeemablePoints(10, program)).toBe(0)
    expect(maxRedeemablePoints(500, program)).toBe(500)
  })
})

describe('summariseLedger', () => {
  it('computes balance, lifetime earned, tier and next', () => {
    const s = summariseLedger(1200, [
      { id: '1', points: 800, kind: 'earn', note: null, created_at: '2026-01-01' },
      { id: '2', points: -200, kind: 'redeem', note: null, created_at: '2026-02-01' },
      { id: '3', points: 600, kind: 'earn', note: null, created_at: '2026-03-01' },
      { id: '4', points: -100, kind: 'adjust', note: 'correction', created_at: '2026-04-01' },
    ])
    expect(s.balance).toBe(1200)
    expect(s.lifetimeEarned).toBe(1400)
    expect(s.tier).toBe('Silver')
    expect(s.next).toEqual({ tier: 'Gold', pointsRemaining: 3600 })
  })
  it('lifetime earned ignores negative rows', () => {
    const s = summariseLedger(0, [{ id: '1', points: -50, kind: 'redeem', note: null, created_at: 'x' }])
    expect(s.lifetimeEarned).toBe(0)
    expect(s.tier).toBe('Bronze')
  })
})

describe('sanitiseProgram — clamp form input', () => {
  it('clamps every field into a sane range', () => {
    const p = sanitiseProgram({
      enabled: true, points_per_100: 5000, point_value: 999, min_redeem_points: -5,
    })
    expect(p).toEqual({ enabled: true, points_per_100: 1000, point_value: 100, min_redeem_points: 0 })
  })
  it('fills defaults for missing fields', () => {
    const p = sanitiseProgram({})
    expect(p).toEqual(DEFAULT_LOYALTY_PROGRAM)
  })
})
