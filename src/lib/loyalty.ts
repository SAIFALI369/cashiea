// ════════════════════════════════════════════════════════════════
// loyalty.ts — the kirana loyalty program brain.
//
// Points earned per ₹100 spent, redeemed as rupees at the POS, tiered
// by lifetime points. All math mirrors the SQL (schema v41):
//   earn  = floor(total / 100 × points_per_100)
//   value = points × point_value
// The ledger is the source of truth server-side; customers.loyalty_points
// is a cache the trigger + redeem RPC maintain.
// ════════════════════════════════════════════════════════════════

export interface LoyaltyProgram {
  enabled: boolean
  /** Points earned per ₹100 spent. */
  points_per_100: number
  /** Rupees one point redeems to. */
  point_value: number
  /** Minimum points per redemption. */
  min_redeem_points: number
}

export const DEFAULT_LOYALTY_PROGRAM: LoyaltyProgram = {
  enabled: false,
  points_per_100: 1,
  point_value: 0.5,
  min_redeem_points: 20,
}

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum'

/** Lifetime-earned points → tier (display + perks; never auto-discount). */
export const TIER_THRESHOLDS: Array<{ tier: LoyaltyTier; lifetimePoints: number; perk: string }> = [
  { tier: 'Bronze', lifetimePoints: 0, perk: 'Earn points on every purchase' },
  { tier: 'Silver', lifetimePoints: 1000, perk: 'Priority WhatsApp service' },
  { tier: 'Gold', lifetimePoints: 5000, perk: 'Suggest a preferred-customer discount' },
  { tier: 'Platinum', lifetimePoints: 20000, perk: 'Suggest festive gifts + first access' },
]

export function tierForLifetimePoints(lifetimePoints: number): LoyaltyTier {
  const pts = Math.max(0, Math.floor(Number(lifetimePoints) || 0))
  let tier: LoyaltyTier = 'Bronze'
  for (const t of TIER_THRESHOLDS) {
    if (pts >= t.lifetimePoints) tier = t.tier
  }
  return tier
}

export function tierPerk(tier: LoyaltyTier): string {
  return TIER_THRESHOLDS.find((t) => t.tier === tier)?.perk || ''
}

/** Next tier + points remaining (null at the top). */
export function nextTier(lifetimePoints: number): { tier: LoyaltyTier; pointsRemaining: number } | null {
  const pts = Math.max(0, Math.floor(Number(lifetimePoints) || 0))
  for (const t of TIER_THRESHOLDS) {
    if (pts < t.lifetimePoints) return { tier: t.tier, pointsRemaining: t.lifetimePoints - pts }
  }
  return null
}

/** Points a sale earns — floor(total/100 × rate), never negative. */
export function pointsForSale(total: number, program: Pick<LoyaltyProgram, 'points_per_100'>): number {
  const rate = Math.max(0, Number(program.points_per_100) || 0)
  const t = Math.max(0, Number(total) || 0)
  return Math.floor((t / 100) * rate)
}

/** Rupee value of a point redemption. */
export function redeemValue(points: number, program: Pick<LoyaltyProgram, 'point_value'>): number {
  const value = Math.max(0, Number(program.point_value) || 0)
  return Math.round(Math.max(0, Math.floor(points)) * value * 100) / 100
}

/** Max points a customer may redeem right now (balance + program caps). */
export function maxRedeemablePoints(balance: number, program: LoyaltyProgram): number {
  const bal = Math.max(0, Math.floor(Number(balance) || 0))
  if (!program.enabled || bal < program.min_redeem_points) return 0
  return bal
}

export interface RedemptionCheck {
  ok: boolean
  error?: string
}

/** Validate a redemption the same way the RPC does (fast client feedback). */
export function checkRedemption(points: number, balance: number, program: LoyaltyProgram): RedemptionCheck {
  if (!program.enabled) return { ok: false, error: 'Loyalty is not enabled' }
  const pts = Math.floor(Number(points) || 0)
  if (pts <= 0) return { ok: false, error: 'Enter how many points to redeem' }
  if (pts < program.min_redeem_points) {
    return { ok: false, error: `Minimum ${program.min_redeem_points} points per redemption` }
  }
  const bal = Math.floor(Number(balance) || 0)
  if (pts > bal) return { ok: false, error: `Only ${bal} points available` }
  return { ok: true }
}

export interface LoyaltyLedgerRow {
  id: string
  points: number
  kind: 'earn' | 'redeem' | 'adjust'
  note: string | null
  created_at: string
}

export interface CustomerLoyalty {
  balance: number
  lifetimeEarned: number
  tier: LoyaltyTier
  next: { tier: LoyaltyTier; pointsRemaining: number } | null
}

/** Summarise a customer's ledger into the display model. */
export function summariseLedger(balance: number, ledger: LoyaltyLedgerRow[]): CustomerLoyalty {
  const bal = Math.max(0, Math.floor(Number(balance) || 0))
  const lifetimeEarned = Math.max(0, ledger.reduce((s, r) => s + (Number(r.points) > 0 ? Number(r.points) : 0), 0))
  return {
    balance: bal,
    lifetimeEarned,
    tier: tierForLifetimePoints(lifetimeEarned),
    next: nextTier(lifetimeEarned),
  }
}

/** Clamp program settings coming from a form into sane values. */
export function sanitiseProgram(input: Partial<LoyaltyProgram>): LoyaltyProgram {
  const clamp = (n: number | undefined, min: number, max: number, dflt: number) => {
    const v = Number(n)
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt
  }
  return {
    enabled: input.enabled === true,
    points_per_100: clamp(input.points_per_100, 0, 1000, DEFAULT_LOYALTY_PROGRAM.points_per_100),
    point_value: Math.round(clamp(input.point_value, 0, 100, DEFAULT_LOYALTY_PROGRAM.point_value) * 100) / 100,
    min_redeem_points: Math.floor(clamp(input.min_redeem_points, 0, 100000, DEFAULT_LOYALTY_PROGRAM.min_redeem_points)),
  }
}
