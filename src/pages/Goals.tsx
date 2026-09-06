import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import {
  GOAL_TEMPLATES, addDays, collectFacts, loadGoals, saveGoals, newGoal, progressOf, startOfWeekMon, weekGrade, ymdLocal,
  type Goal, type GoalKind, type GoalPeriod, type GoalProgress,
} from '../lib/businessGoals'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip } from '../components/ui/StatStrip'
import EmptyState from '../components/ui/EmptyState'
import { Flame, Loader2, Plus, Target, Trash2, TrendingUp, Users, CalendarDays } from 'lucide-react'
import toast from 'react-hot-toast'

const KIND_LABEL: Record<GoalKind, string> = {
  revenue: 'Revenue',
  bills: 'Billing days',
  new_customers: 'New customers',
  streak: 'Streak',
}

function formatActual(g: GoalProgress): string {
  if (g.kind === 'revenue') return formatINR(g.actual, 0)
  if (g.kind === 'streak') return `${g.actual} day${g.actual === 1 ? '' : 's'}`
  return String(g.actual)
}

function formatTarget(g: Goal): string {
  if (g.kind === 'revenue') return formatINR(g.target, 0)
  if (g.kind === 'streak') return `${g.target}-day streak`
  return String(g.target)
}

export default function Goals() {
  const { ownerId } = useAuth()
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<Goal[]>([])
  const [sales, setSales] = useState<{ created_at: string; total: number; status?: string | null }[]>([])
  const [newCust, setNewCust] = useState<string[]>([])
  const [custom, setCustom] = useState<{ kind: GoalKind; period: GoalPeriod; target: string }>({
    kind: 'revenue', period: 'month', target: '',
  })
  const today = ymdLocal(new Date())

  useEffect(() => {
    if (!ownerId) return
    setGoals(loadGoals(ownerId))
    let cancelled = false
    const since = new Date()
    since.setDate(since.getDate() - 90)
    ;(async () => {
      const [tx, cust] = await Promise.all([
        supabase.from('transactions').select('created_at,total,status')
          .eq('user_id', ownerId).gte('created_at', since.toISOString()).limit(2000),
        supabase.from('customers').select('created_at').eq('user_id', ownerId).gte('created_at', since.toISOString()).limit(2000),
      ])
      if (cancelled) return
      setSales((tx.data as any[]) || [])
      setNewCust(((cust.data as any[]) || []).map((c: { created_at: string }) => c.created_at))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const persist = (next: Goal[]) => {
    setGoals(next)
    if (ownerId) {
      try { saveGoals(ownerId, next) } catch { /* private mode */ }
    }
  }

  const monthFacts = useMemo(
    () => collectFacts({ sales, newCustomerDates: newCust, todayYmd: today, period: 'month' }),
    [sales, newCust, today],
  )
  const weekFacts = useMemo(
    () => collectFacts({ sales, newCustomerDates: newCust, todayYmd: today, period: 'week' }),
    [sales, newCust, today],
  )

  const lastWeek = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return collectFacts({ sales, newCustomerDates: newCust, todayYmd: ymdLocal(d), period: 'week' })
  }, [sales, newCust])

  const grade = weekGrade(weekFacts.revenue, lastWeek.revenue)
  const streak = monthFacts.streak
  const rows = goals.map((g) => progressOf(g, g.period === 'week' ? weekFacts : monthFacts))

  const addTemplate = (t: typeof GOAL_TEMPLATES[number]) => {
    if (goals.some((g) => g.kind === t.kind && g.period === t.period && g.target === t.target)) {
      toast.error('That goal is already on the board')
      return
    }
    persist([...goals, newGoal({ kind: t.kind, period: t.period, target: t.target })])
    toast.success('Goal added — lives on this device')
  }

  const addCustom = () => {
    const target = Number(custom.target)
    if (!Number.isFinite(target) || target <= 0) {
      toast.error('Enter a target greater than zero')
      return
    }
    persist([...goals, newGoal({ kind: custom.kind, period: custom.period, target })])
    setCustom({ ...custom, target: '' })
    toast.success('Goal added — lives on this device')
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Goals & streaks"
        subtitle="Targets live on this device — nothing is written to the database. Streak looks back 90 days of completed sales and does not break just because today is still empty."
        icon={<Flame className="w-5 h-5" />}
        visible
      />

      <StatStrip stats={[
        { label: 'Billing streak', value: `${streak} day${streak === 1 ? '' : 's'}`, icon: Flame, tone: streak >= 7 ? 'positive' : 'accent' },
        { label: 'This week', value: formatINR(weekFacts.revenue, 0), icon: TrendingUp, tone: 'default' },
        { label: 'Week grade', value: grade.grade, icon: Target, tone: grade.grade === 'C' ? 'warning' : 'secondary' },
        { label: 'New customers', value: String(monthFacts.newCustomers), icon: Users, tone: 'default' },
      ]} />

      <p className="text-xs text-fg-muted -mt-2 mb-5">{grade.label}</p>

      {rows.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Pick a template or set your own. Progress is computed from live sales — we never invent a number."
        />
      ) : (
        <div className="space-y-3 mb-8">
          {rows.map((g) => (
            <div key={g.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg">
                    {KIND_LABEL[g.kind]} · {g.period === 'week' ? 'this week' : 'this month'}
                  </p>
                  <p className="text-xs text-fg-muted mt-0.5">{formatActual(g)} of {formatTarget(g)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold tabular-nums ${g.hit ? 'text-positive' : 'text-fg'}`}>{Math.round(g.pct)}%</span>
                  <button
                    onClick={() => persist(goals.filter((x) => x.id !== g.id))}
                    className="icon-btn text-fg-subtle hover:text-negative"
                    aria-label="Remove goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-surface-2 mt-3 overflow-hidden">
                <div
                  className={`h-full rounded-full ${g.hit ? 'bg-positive' : 'bg-accent'}`}
                  style={{ width: `${Math.min(100, g.pct)}%` }}
                />
              </div>
              {g.hit
                ? <p className="text-[11px] text-positive mt-2">Hit. Keep the streak going.</p>
                : <p className="text-[11px] text-fg-subtle mt-2">{g.kind === 'revenue' ? `${formatINR(g.remaining, 0)} to go` : `${g.remaining} to go`}</p>}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs font-bold uppercase tracking-wide text-fg-subtle mb-2">Add a goal</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {GOAL_TEMPLATES.map((t) => (
          <button key={t.label} onClick={() => addTemplate(t)} className="chip">
            <Plus className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <p className="text-sm font-semibold text-fg mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-accent" /> Custom target
        </p>
        <div className="grid sm:grid-cols-4 gap-2">
          <select value={custom.kind} onChange={(e) => setCustom({ ...custom, kind: e.target.value as GoalKind })} className="input-field py-2 text-sm" aria-label="Goal type">
            {(Object.keys(KIND_LABEL) as GoalKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
          <select value={custom.period} onChange={(e) => setCustom({ ...custom, period: e.target.value as GoalPeriod })} className="input-field py-2 text-sm" aria-label="Goal period">
            <option value="week">This week</option>
            <option value="month">This month</option>
          </select>
          <input
            type="number"
            min={1}
            value={custom.target}
            onChange={(e) => setCustom({ ...custom, target: e.target.value })}
            className="input-field py-2 text-sm"
            placeholder={custom.kind === 'revenue' ? '₹ target' : 'Target'}
            aria-label="Goal target"
          />
          <button onClick={addCustom} className="btn-primary text-sm h-10">Add</button>
        </div>
      </div>
    </div>
  )
}
