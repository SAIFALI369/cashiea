import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import { buildSmartReminders, type ReminderKind, type ReminderUrgency, type SmartReminder } from '../lib/smartReminders'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip } from '../components/ui/StatStrip'
import EmptyState from '../components/ui/EmptyState'
import {
  Bell, CalendarClock, FileSignature, Gift, Loader2, Package, Users, BookOpen, ArrowRight,
} from 'lucide-react'

const KIND_ICON: Record<ReminderKind, typeof Bell> = {
  gst: FileSignature,
  invoice: Bell,
  festival: Gift,
  dormant: Users,
  stock: Package,
  khata: BookOpen,
}

const URGENCY_CLS: Record<ReminderUrgency, string> = {
  overdue: 'bg-negative/15 text-negative',
  today: 'bg-warning/15 text-warning',
  soon: 'bg-secondary-soft text-secondary-strong',
  upcoming: 'bg-surface-2 text-fg-muted',
}

const FILTERS: { key: 'all' | ReminderKind; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'gst', label: 'GST' },
  { key: 'invoice', label: 'Bills' },
  { key: 'khata', label: 'Khata' },
  { key: 'festival', label: 'Festivals' },
  { key: 'dormant', label: 'Win-back' },
  { key: 'stock', label: 'Stock' },
]

export default function Reminders() {
  const { ownerId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | ReminderKind>('all')
  const [reminders, setReminders] = useState<SmartReminder[]>([])

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    ;(async () => {
      const [inv, cust, kh, prod] = await Promise.all([
        supabase.from('invoices').select('id,invoice_number,client_name,total,due_date,status')
          .eq('user_id', ownerId).in('status', ['sent', 'viewed', 'partial', 'overdue']).limit(500),
        supabase.from('customers').select('id,name,last_purchase_at,total_orders').eq('user_id', ownerId).limit(2000),
        supabase.from('khata_entries').select('id,customer_name,amount,status,created_at').eq('user_id', ownerId).eq('status', 'pending').limit(500),
        supabase.from('products').select('id,stock_quantity,low_stock_threshold,active').eq('user_id', ownerId).limit(2000),
      ])
      if (cancelled) return
      const products = (prod.data as any[]) || []
      const lowStockCount = products.filter((p) => p.active !== false && Number(p.stock_quantity) <= Number(p.low_stock_threshold)).length
      setReminders(buildSmartReminders({
        invoices: (inv.data as any[]) || [],
        customers: (cust.data as any[]) || [],
        khata: (kh.data as any[]) || [],
        lowStockCount,
      }))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const shown = useMemo(
    () => (filter === 'all' ? reminders : reminders.filter((r) => r.kind === filter)),
    [reminders, filter],
  )
  const overdue = reminders.filter((r) => r.urgency === 'overdue').length
  const today = reminders.filter((r) => r.urgency === 'today').length

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Smart reminders"
        subtitle="GST dates, overdue bills, festivals, quiet customers and low stock — pulled from your live data. Confirm GST with your CA."
        icon={<CalendarClock className="w-5 h-5" />}
        visible
      />

      <StatStrip stats={[
        { label: 'Open', value: String(reminders.length), icon: Bell, tone: 'default' },
        { label: 'Overdue', value: String(overdue), icon: FileSignature, tone: overdue ? 'negative' : 'positive' },
        { label: 'Today', value: String(today), icon: CalendarClock, tone: today ? 'warning' : 'default' },
        { label: 'Win-backs', value: String(reminders.filter((r) => r.kind === 'dormant').length), icon: Users, tone: 'secondary' },
      ]} />

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)} className={`chip whitespace-nowrap ${filter === f.key ? 'chip-active' : ''}`}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={filter === 'all' ? 'Nothing pending' : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} reminders`}
          description="When a GST date, invoice due, festival or quiet regular comes up, it will land here."
        />
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const Icon = KIND_ICON[r.kind]
            return (
              <div key={r.id} className="card p-4 flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-surface-2 text-fg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-fg">{r.title}</p>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${URGENCY_CLS[r.urgency]}`}>{r.urgency}</span>
                  </div>
                  <p className="text-xs text-fg-muted mt-1 leading-relaxed">{r.detail}</p>
                  {r.amount ? <p className="text-xs font-semibold tabular-nums text-fg mt-1">{formatINR(r.amount, 0)}</p> : null}
                </div>
                {r.href && (
                  <Link to={r.href} className="btn-ghost text-xs h-9 px-3 flex-shrink-0">
                    {r.actionLabel || 'Open'} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
