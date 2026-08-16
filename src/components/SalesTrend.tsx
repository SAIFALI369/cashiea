import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, TrendingDown, ChevronDown } from 'lucide-react'
import { formatINR } from '../lib/format'

/**
 * SalesTrend — hero sales metric + trend line for the Reports page.
 * Period selector (default "This month"), total sales for the period, %
 * change vs the previous equal-length period (green/red), and an SVG line
 * chart of daily sales. Pulls from `transactions` (completed) — the same
 * source that powers "Sales today" on the dashboard, extended to a range.
 */
const PERIODS = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'This month', days: 30 },
  { key: '90d', label: 'Last 3 months', days: 90 },
  { key: '365d', label: 'This year', days: 365 },
] as const

export function SalesTrend({ ownerId }: { ownerId: string | null | undefined }) {
  const [key, setKey] = useState<string>('30d')
  const [daily, setDaily] = useState<number[]>([])
  const [curTotal, setCurTotal] = useState(0)
  const [pct, setPct] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const days = PERIODS.find((p) => p.key === key)?.days ?? 30
    const now = Date.now()
    const curStart = now - days * 86400000
    const prevStart = now - 2 * days * 86400000
    ;(async () => {
      if (!ownerId) { setLoading(false); return }
      setLoading(true)
      const { data } = await supabase
        .from('transactions')
        .select('total,created_at')
        .eq('user_id', ownerId)
        .eq('status', 'completed')
        .gte('created_at', new Date(prevStart).toISOString())
      const rows = (data as { total: number; created_at: string }[]) || []
      const buckets = new Array(days).fill(0)
      let cur = 0
      let prev = 0
      rows.forEach((r) => {
        const t = new Date(r.created_at).getTime()
        const total = Number(r.total) || 0
        if (t >= curStart) {
          cur += total
          const idx = Math.min(days - 1, Math.max(0, Math.floor((t - curStart) / 86400000)))
          buckets[idx] += total
        } else {
          prev += total
        }
      })
      if (cancelled) return
      setDaily(buckets)
      setCurTotal(cur)
      setPct(prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [key, ownerId])

  const max = Math.max(1, ...daily)
  const W = 320
  const H = 96
  const pad = 4
  const step = daily.length > 1 ? (W - pad * 2) / (daily.length - 1) : 0
  const pts = daily
    .map((v, i) => `${(pad + i * step).toFixed(1)},${(H - pad - (v / max) * (H - pad * 2)).toFixed(1)}`)
    .join(' ')
  const area = `${pad},${H - pad} ${pts} ${W - pad},${H - pad}`
  const up = (pct ?? 0) >= 0

  return (
    <div className="card p-5 mb-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-xs text-fg-subtle">Total sales · {PERIODS.find((p) => p.key === key)?.label}</p>
          {loading ? (
            <div className="h-9 w-44 bg-surface-2 rounded animate-pulse mt-1.5" />
          ) : (
            <>
              <p className="text-3xl font-bold text-fg mt-0.5">{formatINR(curTotal, 0)}</p>
              {pct !== null && (
                <p className={`text-xs font-semibold mt-1.5 inline-flex items-center gap-1 ${up ? 'text-positive' : 'text-negative'}`}>
                  {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {up ? '+' : ''}
                  {pct.toFixed(1)}% vs previous period
                </p>
              )}
            </>
          )}
        </div>
        <div className="relative flex-shrink-0">
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="input-field text-xs py-1.5 pl-3 pr-8 appearance-none cursor-pointer"
            aria-label="Time period"
          >
            {PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-fg-subtle absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
      <div className="w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none" role="img" aria-label="Sales trend">
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#salesFill)" />
          <polyline points={pts} fill="none" stroke="rgb(var(--accent))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

export default SalesTrend
