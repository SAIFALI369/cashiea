import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import { computeSnapshot, type SnapshotPeriod, type SnapshotStats } from '../lib/businessSnapshot'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { Download, Loader2, Share2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const PERIODS: { key: SnapshotPeriod; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
]

export default function Snapshot() {
  const { profile, ownerId } = useAuth()
  const [period, setPeriod] = useState<SnapshotPeriod>('today')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SnapshotStats | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    setLoading(true)
    const from = period === 'today'
      ? new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString()
      : period === 'week'
        ? new Date(Date.now() - 7 * 86400000).toISOString()
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    ;(async () => {
      const [tx, prod, inv] = await Promise.all([
        supabase.from('transactions').select('created_at,total,status,items').eq('user_id', ownerId).eq('status', 'completed').gte('created_at', from).limit(1000),
        supabase.from('products').select('id,cost,stock_quantity,low_stock_threshold,active').eq('user_id', ownerId).limit(2000),
        supabase.from('invoices').select('total,status').eq('user_id', ownerId).in('status', ['sent', 'viewed', 'partial', 'overdue']).limit(500),
      ])
      if (cancelled) return
      const products = (prod.data as any[]) || []
      const lowStock = products.filter((p) => p.active !== false && Number(p.stock_quantity) <= Number(p.low_stock_threshold)).length
      const pendingDues = ((inv.data as any[]) || []).reduce((s, i) => s + (Number(i.total) || 0), 0)
      setStats(computeSnapshot({
        period,
        shopName: profile?.company_name || profile?.full_name || 'My shop',
        sales: (tx.data as any[]) || [],
        costs: products.map((p) => ({ id: p.id, cost: Number(p.cost) || 0 })),
        lowStock,
        pendingDues,
      }))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId, period, profile?.company_name, profile?.full_name])

  useEffect(() => {
    if (stats && canvasRef.current) drawSnapshot(canvasRef.current, stats)
  }, [stats])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `cashiea-snapshot-${stats?.period || 'today'}.png`
    a.click()
    toast.success('Snapshot saved')
  }

  const share = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('Could not build the image')
      const file = new File([blob], 'cashiea-snapshot.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: stats?.shopName, text: `${stats?.shopName} · ${stats?.dateLabel}` })
        return
      }
      download()
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return
      download()
    }
  }

  return (
    <div className="animate-fade-in max-w-lg">
      <PageHeader
        title="Business snapshot"
        subtitle="A square card ready for WhatsApp status or a partner group. Profit is shown only when enough items have a cost price."
        icon={<Sparkles className="w-5 h-5" />}
        visible
        action={
          <div className="flex gap-2">
            <button onClick={share} className="btn-primary text-sm" disabled={!stats}><Share2 className="w-4 h-4" /> Share</button>
            <button onClick={download} className="btn-secondary text-sm" disabled={!stats}><Download className="w-4 h-4" /> Save</button>
          </div>
        }
      />

      <div className="flex gap-2 mb-5">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${period === p.key ? 'bg-secondary-soft text-secondary-strong' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : !stats ? (
        <EmptyState icon={Sparkles} title="No snapshot yet" description="Ring up a sale and come back — the card fills itself." />
      ) : (
        <>
          <div className="rounded-2xl overflow-hidden border border-line shadow-float bg-surface">
            <canvas ref={canvasRef} width={1080} height={1080} className="w-full h-auto block" />
          </div>
          {stats.profit == null && stats.bills > 0 && (
            <p className="text-[11px] text-fg-subtle mt-3 leading-relaxed">
              Profit is hidden because only {stats.profitCoverage}% of sold lines have a cost price. Fill costs in Stock for an honest number.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function drawSnapshot(canvas: HTMLCanvasElement, s: SnapshotStats) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height

  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#042f2e')
  bg.addColorStop(1, '#0f172a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Accent orb
  const orb = ctx.createRadialGradient(180, 160, 20, 180, 160, 420)
  orb.addColorStop(0, 'rgba(16,185,129,0.35)')
  orb.addColorStop(1, 'rgba(16,185,129,0)')
  ctx.fillStyle = orb
  ctx.fillRect(0, 0, W, H)

  ctx.fillStyle = '#34d399'
  ctx.font = '700 36px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('CASHIEA', 80, 110)

  ctx.fillStyle = '#f8fafc'
  ctx.font = '700 64px ui-sans-serif, system-ui, sans-serif'
  fitText(ctx, s.shopName, 80, 200, W - 160, 64)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 32px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(s.dateLabel, 80, 260)

  const tiles: { label: string; value: string }[] = [
    { label: 'SALES', value: formatINR(s.sales, 0) },
    { label: 'BILLS', value: String(s.bills) },
    { label: 'PROFIT', value: s.profit == null ? '—' : formatINR(s.profit, 0) },
    { label: 'PENDING', value: formatINR(s.pendingDues, 0) },
  ]
  tiles.forEach((t, i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 80 + col * 470
    const y = 340 + row * 230
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    roundRect(ctx, x, y, 430, 200, 28)
    ctx.fill()
    ctx.fillStyle = '#64748b'
    ctx.font = '700 26px ui-sans-serif, system-ui, sans-serif'
    ctx.fillText(t.label, x + 36, y + 58)
    ctx.fillStyle = '#f8fafc'
    ctx.font = '700 56px ui-sans-serif, system-ui, sans-serif'
    fitText(ctx, t.value, x + 36, y + 140, 360, 56)
  })

  ctx.fillStyle = '#94a3b8'
  ctx.font = '500 28px ui-sans-serif, system-ui, sans-serif'
  const footer = s.topItem
    ? `Top item · ${s.topItem.name} (${s.topItem.qty})`
    : s.bills === 0
      ? 'Quiet day — ready for the first bill'
      : `${s.lowStock} low-stock item${s.lowStock === 1 ? '' : 's'}`
  ctx.fillText(footer, 80, 920)

  ctx.fillStyle = '#34d399'
  ctx.font = '600 26px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('Made with Cashiea', 80, 990)
}

function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number) {
  let s = size
  ctx.font = `700 ${s}px ui-sans-serif, system-ui, sans-serif`
  while (s > 22 && ctx.measureText(text).width > maxW) {
    s -= 2
    ctx.font = `700 ${s}px ui-sans-serif, system-ui, sans-serif`
  }
  ctx.fillText(text, x, y)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
