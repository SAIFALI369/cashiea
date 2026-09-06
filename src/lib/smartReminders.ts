// ════════════════════════════════════════════════════════════════
// Smart reminders — GST calendar, invoice dues, festivals, dormant
// customers, low stock. Pure functions; the page just renders them.
//
// Sources: india-compliance GST filing calendar + a hardcoded Indian
// festival list for 2026–2027 (no network). Not legal advice.
// ════════════════════════════════════════════════════════════════

const DAY = 86_400_000

export type ReminderKind = 'gst' | 'invoice' | 'festival' | 'dormant' | 'stock' | 'khata'
export type ReminderUrgency = 'overdue' | 'today' | 'soon' | 'upcoming'

export interface SmartReminder {
  id: string
  kind: ReminderKind
  urgency: ReminderUrgency
  title: string
  detail: string
  /** YYYY-MM-DD the reminder is anchored to. */
  date: string
  /** Negative = already past. */
  daysUntil: number
  amount?: number
  href?: string
  actionLabel?: string
}

export interface ReminderInvoice {
  id: string
  invoice_number: string
  client_name: string
  total: number
  due_date: string | null
  status: string
}

export interface ReminderCustomer {
  id: string
  name: string
  last_purchase_at: string | null
  total_orders: number
}

export interface ReminderKhata {
  id: string
  customer_name: string
  amount: number
  status: string
  created_at: string
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function daysUntil(iso: string, today: Date): number {
  const [y, m, day] = iso.split('-').map(Number)
  const target = new Date(y, (m || 1) - 1, day || 1)
  return Math.round((startOfLocalDay(target).getTime() - startOfLocalDay(today).getTime()) / DAY)
}

function urgencyFromDays(n: number): ReminderUrgency {
  if (n < 0) return 'overdue'
  if (n === 0) return 'today'
  if (n <= 3) return 'soon'
  return 'upcoming'
}

function monthName(d: Date): string {
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

/** Indian festival calendar. Dates are civil-calendar observances. */
export const INDIAN_FESTIVALS: { date: string; name: string; greeting: string }[] = [
  { date: '2026-01-14', name: 'Makar Sankranti', greeting: 'Happy Makar Sankranti' },
  { date: '2026-01-26', name: 'Republic Day', greeting: 'Happy Republic Day' },
  { date: '2026-03-03', name: 'Holi', greeting: 'Happy Holi' },
  { date: '2026-03-20', name: 'Eid al-Fitr', greeting: 'Eid Mubarak' },
  { date: '2026-04-14', name: 'Baisakhi / Tamil New Year', greeting: 'Happy New Year' },
  { date: '2026-05-27', name: 'Eid al-Adha', greeting: 'Eid Mubarak' },
  { date: '2026-08-15', name: 'Independence Day', greeting: 'Happy Independence Day' },
  { date: '2026-08-28', name: 'Raksha Bandhan', greeting: 'Happy Raksha Bandhan' },
  { date: '2026-09-04', name: 'Janmashtami', greeting: 'Happy Janmashtami' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi', greeting: 'Ganpati Bappa Morya' },
  { date: '2026-10-02', name: 'Gandhi Jayanti', greeting: 'Happy Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dussehra', greeting: 'Happy Dussehra' },
  { date: '2026-11-08', name: 'Diwali', greeting: 'Happy Diwali' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti', greeting: 'Happy Gurpurab' },
  { date: '2026-12-25', name: 'Christmas', greeting: 'Merry Christmas' },
  { date: '2027-01-14', name: 'Makar Sankranti', greeting: 'Happy Makar Sankranti' },
  { date: '2027-01-26', name: 'Republic Day', greeting: 'Happy Republic Day' },
  { date: '2027-03-22', name: 'Holi', greeting: 'Happy Holi' },
  { date: '2027-03-10', name: 'Eid al-Fitr', greeting: 'Eid Mubarak' },
  { date: '2027-08-15', name: 'Independence Day', greeting: 'Happy Independence Day' },
  { date: '2027-10-21', name: 'Diwali', greeting: 'Happy Diwali' },
  { date: '2027-12-25', name: 'Christmas', greeting: 'Merry Christmas' },
]

export function gstDueDates(today: Date): { form: string; due: string; period: string; note: string }[] {
  const day = today.getDate()
  const forms: { form: string; dueDay: number; note: string }[] = [
    { form: 'GSTR-1', dueDay: 11, note: 'Outward supplies for the previous month — confirm with your CA before filing.' },
    { form: 'GSTR-3B', dueDay: 20, note: 'Summary return + tax payment for the previous month — confirm with your CA.' },
  ]
  return forms.map((f) => {
    // If this month's due date is more than 10 days past, jump to next month.
    let due = new Date(today.getFullYear(), today.getMonth(), f.dueDay)
    if (day > f.dueDay + 10) {
      due = new Date(today.getFullYear(), today.getMonth() + 1, f.dueDay)
    }
    const period = new Date(due.getFullYear(), due.getMonth() - 1, 1)
    return { form: f.form, due: ymd(due), period: monthName(period), note: f.note }
  })
}

const UNPAID = new Set(['sent', 'viewed', 'partial', 'overdue'])

export function buildSmartReminders(input: {
  today?: Date
  invoices?: ReminderInvoice[]
  customers?: ReminderCustomer[]
  khata?: ReminderKhata[]
  lowStockCount?: number
  horizonDays?: number
}): SmartReminder[] {
  const today = input.today ?? new Date()
  const horizon = input.horizonDays ?? 21
  const out: SmartReminder[] = []

  for (const g of gstDueDates(today)) {
    const n = daysUntil(g.due, today)
    if (n > horizon) continue
    out.push({
      id: `gst-${g.form}-${g.due}`,
      kind: 'gst',
      urgency: urgencyFromDays(n),
      title: `${g.form} ${n < 0 ? 'overdue' : n === 0 ? 'due today' : `due in ${n} day${n === 1 ? '' : 's'}`}`,
      detail: `${g.period} · ${g.note}`,
      date: g.due,
      daysUntil: n,
      href: '/app/gst-export',
      actionLabel: 'Open GST export',
    })
  }

  for (const inv of input.invoices || []) {
    if (!UNPAID.has(inv.status) && inv.status !== 'draft') continue
    const due = (inv.due_date || '').slice(0, 10)
    if (!due) continue
    const n = daysUntil(due, today)
    if (n > 7) continue
    const overdue = n < 0
    out.push({
      id: `inv-${inv.id}`,
      kind: 'invoice',
      urgency: urgencyFromDays(n),
      title: overdue
        ? `${inv.invoice_number} is ${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'} overdue`
        : n === 0
          ? `${inv.invoice_number} is due today`
          : `${inv.invoice_number} due in ${n} day${n === 1 ? '' : 's'}`,
      detail: `${inv.client_name || 'Customer'} · ₹${Number(inv.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      date: due,
      daysUntil: n,
      amount: Number(inv.total) || 0,
      href: '/app/invoices',
      actionLabel: 'Open bills',
    })
  }

  for (const k of input.khata || []) {
    if (k.status !== 'pending') continue
    const n = daysUntil(ymd(new Date(k.created_at)), today) // negative as it ages
    const age = -n
    if (age < 14) continue
    out.push({
      id: `khata-${k.id}`,
      kind: 'khata',
      urgency: age >= 45 ? 'overdue' : 'soon',
      title: `${k.customer_name}'s khata is ${age} days old`,
      detail: `₹${Number(k.amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} pending — a polite reminder usually works.`,
      date: (k.created_at || '').slice(0, 10),
      daysUntil: -age,
      amount: Number(k.amount) || 0,
      href: '/app/khata',
      actionLabel: 'Open khata',
    })
  }

  for (const f of INDIAN_FESTIVALS) {
    const n = daysUntil(f.date, today)
    if (n < 0 || n > 14) continue
    out.push({
      id: `fest-${f.date}-${f.name}`,
      kind: 'festival',
      urgency: urgencyFromDays(n),
      title: n === 0 ? `${f.name} is today` : `${f.name} in ${n} day${n === 1 ? '' : 's'}`,
      detail: `${f.greeting} — a short WhatsApp to regulars goes a long way.`,
      date: f.date,
      daysUntil: n,
      href: '/app/campaigns',
      actionLabel: 'Draft a greeting',
    })
  }

  for (const c of input.customers || []) {
    if (!c.last_purchase_at || !c.total_orders) continue
    const last = new Date(c.last_purchase_at)
    if (!Number.isFinite(last.getTime())) continue
    const age = Math.floor((startOfLocalDay(today).getTime() - startOfLocalDay(last).getTime()) / DAY)
    if (age < 30 || age > 400) continue
    out.push({
      id: `dormant-${c.id}`,
      kind: 'dormant',
      urgency: age >= 90 ? 'soon' : 'upcoming',
      title: `${c.name} hasn't visited in ${age} days`,
      detail: 'A win-back message now is cheaper than finding a new regular.',
      date: ymd(last),
      daysUntil: -age,
      href: '/app/customers',
      actionLabel: 'Open customers',
    })
  }

  const low = Number(input.lowStockCount) || 0
  if (low > 0) {
    out.push({
      id: 'stock-low',
      kind: 'stock',
      urgency: 'soon',
      title: `${low} item${low === 1 ? '' : 's'} below the reorder alert`,
      detail: 'Auto-reorder can size a draft PO from recent sales velocity.',
      date: ymd(today),
      daysUntil: 0,
      href: '/app/auto-reorder',
      actionLabel: 'Open auto-reorder',
    })
  }

  const rank: Record<ReminderUrgency, number> = { overdue: 0, today: 1, soon: 2, upcoming: 3 }
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency] || a.daysUntil - b.daysUntil)
}
