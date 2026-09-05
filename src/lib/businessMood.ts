import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from './supabase'

// ────────────────────────────────────────────────────────────────
// Business mood — the single source of truth for Meraj's resting
// expression. Every consumer (Dashboard card, floating assistant,
// full Meraj panel, bottom-nav launcher) calls this same logic so
// the emotional state is never hardcoded or duplicated.
// ────────────────────────────────────────────────────────────────

export type BusinessMood = 'happy' | 'neutral' | 'sad'

export interface BusinessSignals {
  /** Today's completed-sales revenue. */
  todayRevenue: number
  /** Average daily revenue over recent history (null = not enough data yet). */
  recentAvgDailyRevenue: number | null
  /** Count of invoices with status 'overdue'. */
  overdueInvoiceCount: number
  /** Count of products at/below their low-stock threshold. */
  lowStockCount: number
}

/**
 * The existing low-stock detection predicate (same rule the Dashboard
 * "Low Stock" card has always used): quantity at/below the product's
 * own threshold. Shared here so mood + Dashboard + alert surfaces can
 * never drift apart.
 */
export function isLowStock(p: { stock_quantity?: number | null; low_stock_threshold?: number | null }): boolean {
  return Number(p.stock_quantity ?? 0) <= Number(p.low_stock_threshold ?? 0)
}

/**
 * Average daily revenue across the rows given, computed over the
 * DISTINCT days that actually had sales (min 3 active days before the
 * average is trusted — below that we have "insufficient data").
 * Exclude today's rows when calling.
 */
export function averageDailyRevenue(
  rows: { created_at?: string | null; total?: number | string | null }[],
  minActiveDays = 3,
): number | null {
  if (!rows || rows.length === 0) return null
  const days = new Set<string>()
  let sum = 0
  for (const r of rows) {
    const d = r.created_at ? new Date(r.created_at) : null
    if (d && !Number.isNaN(d.getTime())) {
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
    }
    sum += Number(r.total || 0)
  }
  if (days.size < minActiveDays) return null // insufficient history
  return sum / days.size
}

/**
 * Mood rules (positive by default — the app should feel encouraging):
 *  - 'sad'    → a demonstrable revenue problem: today's revenue has fallen
 *               below 50% of the recent daily average. Overdue invoices and
 *               low stock surface as advice cards instead — they are to-dos,
 *               not reasons to look devastated.
 *  - 'happy'  → everything else, including insufficient data yet. Meraj is
 *               a reassuring companion, not an alarm.
 */
export function computeBusinessMood(s: BusinessSignals): BusinessMood {
  const significantDrop =
    s.recentAvgDailyRevenue !== null && s.todayRevenue < s.recentAvgDailyRevenue * 0.5
  // Only a demonstrable revenue loss changes his face; problems become
  // advice, not emotional guilt.
  if (significantDrop) return 'sad'
  return 'happy'
}

/**
 * React hook: fetches the same signals the Dashboard hero uses and
 * derives the mood via computeBusinessMood. Returns null while data
 * is loading (callers can fall back to 'neutral').
 */
export function useBusinessMood(): BusinessMood | null {
  const { profile, ownerId } = useAuth()
  const [mood, setMood] = useState<BusinessMood | null>(null)

  useEffect(() => {
    if (!profile || !ownerId) {
      setMood(null)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const now = new Date()
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const windowStart = new Date(now.getTime() - 14 * 86400000).toISOString()

        const [todayRes, recentRes, overdueRes, stockRes] = await Promise.all([
          supabase.from('transactions').select('created_at, total').eq('user_id', ownerId)
            .eq('status', 'completed').gte('created_at', startToday),
          supabase.from('transactions').select('created_at, total').eq('user_id', ownerId)
            .eq('status', 'completed').gte('created_at', windowStart).lt('created_at', startToday),
          supabase.from('invoices').select('id').eq('user_id', ownerId).eq('status', 'overdue'),
          supabase.from('products').select('stock_quantity, low_stock_threshold').eq('user_id', ownerId),
        ])
        if (cancelled) return

        const today = (todayRes.data ?? []) as { total?: number | string | null }[]
        const recent = (recentRes.data ?? []) as { created_at?: string | null; total?: number | string | null }[]
        const products = (stockRes.data ?? []) as { stock_quantity?: number | null; low_stock_threshold?: number | null }[]

        setMood(computeBusinessMood({
          todayRevenue: today.reduce((s, t) => s + Number(t.total || 0), 0),
          recentAvgDailyRevenue: averageDailyRevenue(recent),
          overdueInvoiceCount: (overdueRes.data ?? []).length,
          lowStockCount: products.filter(isLowStock).length,
        }))
      } catch {
        if (!cancelled) setMood(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [profile, ownerId])

  return mood
}
