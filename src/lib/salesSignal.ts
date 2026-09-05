// ════════════════════════════════════════════════════════════════
// "Sales today" comparison signal — shared by the Dashboard stat card
// and Meraj's pulse chips.
//
// RULE: zero sales is NOT a loss. An empty morning (shop just opened,
// no bills yet) is neutral information, never a red alarm. A negative
// tone requires actual sales today that trail yesterday's.
// ════════════════════════════════════════════════════════════════

export type SignalTone = 'good' | 'bad' | 'neutral'

export interface SalesSignal {
  /** % change vs yesterday; null when a percentage is not meaningful. */
  delta: number | null
  tone: SignalTone
  /** True when there is nothing to alarm about — render it quietly. */
  quiet: boolean
}

export function salesSignal(today: number, yesterday: number): SalesSignal {
  const t = Number.isFinite(today) ? (today as number) : 0
  const y = Number.isFinite(yesterday) ? (yesterday as number) : 0

  // No sales yet today — "no sales" is not a loss, whatever yesterday did.
  if (!(t > 0)) return { delta: null, tone: 'neutral', quiet: true }

  // Selling today with no baseline yesterday — growth we can't percentage.
  if (!(y > 0)) return { delta: null, tone: 'good', quiet: false }

  const delta = Math.round(((t - y) / y) * 100)
  return { delta, tone: delta >= 0 ? 'good' : 'bad', quiet: false }
}
