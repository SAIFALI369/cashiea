import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TrendingUp, TrendingDown, ChevronDown, Check } from 'lucide-react'
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
  const [pickerOpen, setPickerOpen] = useState(false)

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
  const points = daily.map((v, i) => ({
    x: pad + i * step,
    y: H - pad - (v / max) * (H - pad * 2),
  }))
  const smoothPath = (values: Array<{ x: number; y: number }>) => {
    if (!values.length) return ''
    if (values.length === 1) return `M ${values[0].x} ${values[0].y}`
    let path = `M ${values[0].x.toFixed(1)} ${values[0].y.toFixed(1)}`
    for (let i = 1; i < values.length - 1; i += 1) {
      const midX = (values[i].x + values[i + 1].x) / 2
      const midY = (values[i].y + values[i + 1].y) / 2
      path += ` Q ${values[i].x.toFixed(1)} ${values[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`
    }
    const last = values[values.length - 1]
    path += ` Q ${last.x.toFixed(1)} ${last.y.toFixed(1)} ${last.x.toFixed(1)} ${last.y.toFixed(1)}`
    return path
  }
  const linePath = smoothPath(points)
  const area = `${linePath} L ${W - pad} ${H - pad} L ${pad} ${H - pad} Z`
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
              <p className="mt-0.5 whitespace-nowrap text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{formatINR(curTotal, 0)}</p>
              {pct !== null && <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />} {up ? '+' : ''}{pct.toFixed(0)}% vs last period
              </span>}
            </>
          )}
        </div>
        <button onClick={() => setPickerOpen(true)} className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs font-semibold text-fg-muted" aria-label="Choose time period">{PERIODS.find((p) => p.key === key)?.label}<ChevronDown className="h-3.5 w-3.5" /></button>
      </div>
      <div className="w-full">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none" role="img" aria-label="Sales trend">
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#salesFill)" />
          <path d={linePath} fill="none" stroke="rgb(var(--accent))" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      </div>
      {pickerOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setPickerOpen(false)} role="dialog" aria-label="Choose report period">
        <div className="card w-full rounded-b-none p-5 sm:max-w-sm sm:rounded-[20px]" onClick={(event) => event.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between"><h3 className="text-base font-bold text-fg">Choose period</h3><button onClick={() => setPickerOpen(false)} className="text-sm font-medium text-fg-subtle">Close</button></div>
          <div className="space-y-1">{PERIODS.map((period) => <button key={period.key} onClick={() => { setKey(period.key); setPickerOpen(false) }} className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left text-sm font-semibold text-fg hover:bg-surface-2">{period.label}{period.key === key && <Check className="h-5 w-5 text-accent-strong" />}</button>)}</div>
        </div>
      </div>}
    </div>
  )
}

export default SalesTrend
