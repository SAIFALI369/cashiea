import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatINR } from '../../lib/format'
import {
  shiftMinutes, computeStaffPerformance,
  type StaffShift, type CommissionRule, type ServedSale,
} from '../../lib/workforce'
import { Clock, LogIn, LogOut, Timer, Plus, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Workforce — the shift clock + commission estimate, mounted on the Team
 * page. Staff clock themselves in/out (their own rows, business-scoped);
 * the owner additionally sets commission % per staff NAME (sales record
 * served_by as the display name) and sees the 30-day performance table.
 *
 * Deliberately NOT payroll — hours and commission are estimates the
 * owner settles with their CA.
 */
interface Props {
  ownerId: string | null | undefined
  profileId: string | null | undefined
  staffName: string
  isOwner: boolean
}

function minsToHm(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function Workforce({ ownerId, profileId, staffName, isOwner }: Props) {
  const [loading, setLoading] = useState(true)
  const [shifts, setShifts] = useState<StaffShift[]>([])
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [sales, setSales] = useState<ServedSale[]>([])
  const [busy, setBusy] = useState(false)
  const [breakInput, setBreakInput] = useState('0')
  const [newRule, setNewRule] = useState<{ name: string; percent: string }>({ name: '', percent: '' })
  const [savingRule, setSavingRule] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    setLoading(true)
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    ;(async () => {
      const [sh, ru, sa] = await Promise.all([
        supabase.from('staff_shifts').select('id,staff_name,clock_in,clock_out,break_minutes,note,staff_user_id')
          .eq('user_id', ownerId).gte('clock_in', `${from}T00:00:00`).order('clock_in', { ascending: false }).limit(200),
        supabase.from('commission_rules').select('id,staff_name,percent,active').eq('user_id', ownerId).limit(50),
        supabase.from('transactions').select('served_by,total,created_at,status')
          .eq('user_id', ownerId).eq('status', 'completed').gte('created_at', `${from}T00:00:00`).order('created_at', { ascending: false }).limit(3000),
      ])
      if (cancelled) return
      setShifts((sh.data as (StaffShift & { staff_user_id?: string | null })[]) || [])
      setRules((ru.data as CommissionRule[]) || [])
      setSales((sa.data as ServedSale[]) || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const myOpenShift = useMemo(() => {
    if (!profileId) return null
    return shifts.find((s) => (s as unknown as { staff_user_id?: string | null }).staff_user_id === profileId && !s.clock_out) || null
  }, [shifts, profileId])

  const todayKey = new Date().toISOString().slice(0, 10)
  const todayShifts = useMemo(
    () => shifts.filter((s) => s.clock_in.slice(0, 10) === todayKey),
    [shifts, todayKey],
  )

  const performance = useMemo(() => {
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    return computeStaffPerformance(sales, rules, shifts, { from, to: todayKey })
  }, [sales, rules, shifts, todayKey])

  const clockIn = async () => {
    if (!ownerId || !profileId) return
    setBusy(true)
    try {
      const { error } = await supabase.from('staff_shifts').insert({
        user_id: ownerId, staff_user_id: profileId, staff_name: staffName || 'Staff',
        clock_in: new Date().toISOString(),
      })
      if (error) throw error
      const { data } = await supabase.from('staff_shifts')
        .select('id,staff_name,clock_in,clock_out,break_minutes,note,staff_user_id')
        .eq('user_id', ownerId).eq('staff_user_id', profileId).is('clock_out', null).order('clock_in', { ascending: false }).limit(1)
      if (data?.[0]) setShifts((prev) => [data[0] as StaffShift, ...prev])
      toast.success('Clocked in — shift started')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not clock in')
    } finally {
      setBusy(false)
    }
  }

  const clockOut = async () => {
    if (!ownerId || !myOpenShift) return
    setBusy(true)
    try {
      const clockOut = new Date().toISOString()
      const breakMinutes = Math.max(0, Math.min(600, Math.floor(Number(breakInput) || 0)))
      const { error } = await supabase.from('staff_shifts')
        .update({ clock_out: clockOut, break_minutes: breakMinutes })
        .eq('id', myOpenShift.id).eq('user_id', ownerId)
      if (error) throw error
      setShifts((prev) => prev.map((s) => (s.id === myOpenShift.id ? { ...s, clock_out: clockOut, break_minutes: breakMinutes } : s)))
      toast.success('Clocked out — shift recorded')
      setBreakInput('0')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not clock out')
    } finally {
      setBusy(false)
    }
  }

  const saveRule = async () => {
    if (!ownerId) return
    const name = newRule.name.trim()
    const percent = Number(newRule.percent)
    if (!name) return toast.error('Staff name is required')
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) return toast.error('Commission % must be 0–100')
    setSavingRule(true)
    try {
      const { data, error } = await supabase.from('commission_rules')
        .upsert({ user_id: ownerId, staff_name: name, percent, active: true }, { onConflict: 'user_id,staff_name' })
        .select().single()
      if (error) throw error
      setRules((prev) => {
        const next = prev.filter((r) => r.staff_name.toLowerCase() !== name.toLowerCase())
        return [...next, data as CommissionRule]
      })
      setNewRule({ name: '', percent: '' })
      toast.success(`${percent}% commission set for ${name}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the rule')
    } finally {
      setSavingRule(false)
    }
  }

  const removeRule = async (rule: CommissionRule) => {
    try {
      const { error } = await supabase.from('commission_rules').delete().eq('id', rule.id).eq('user_id', ownerId)
      if (error) throw error
      setRules((prev) => prev.filter((r) => r.id !== rule.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove the rule')
    }
  }

  if (loading) {
    return (
      <section className="card p-5 mt-6 flex items-center gap-2 text-sm text-fg-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading shifts & commission…
      </section>
    )
  }

  return (
    <section className="workforce-card card mt-6 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-fg-muted" />
        <h2 className="text-sm font-bold text-fg">Shift clock & commission</h2>
      </div>

      {/* My shift */}
      <div className="mb-4 rounded-2xl bg-surface-2 p-5">
        <p className="text-xs font-semibold text-fg-subtle">Current time</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-fg">{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">
            {myOpenShift ? 'On the clock' : 'Not clocked in'}
          </p>
          <p className="text-xs text-fg-subtle mt-0.5">
            {myOpenShift
              ? `Since ${new Date(myOpenShift.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · ${minsToHm(shiftMinutes(myOpenShift))} worked`
              : 'Clock in when your counter shift starts'}
          </p>
        </div>
        {myOpenShift ? (
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} max={600} value={breakInput}
              onChange={(e) => setBreakInput(e.target.value)}
              className="w-20 px-2.5 py-2 bg-surface rounded-lg text-right text-sm tabular-nums border-0 focus:ring-2 focus:ring-accent/40 focus:outline-none"
              aria-label="Break minutes" title="Break minutes to subtract"
              placeholder="Break"
            />
            <button onClick={clockOut} disabled={busy} className="btn-primary text-xs py-2.5">
              <LogOut className="w-3.5 h-3.5" /> Clock out
            </button>
          </div>
        ) : (
          <button onClick={clockIn} disabled={busy || !profileId} className="btn-primary text-xs py-2.5">
            <LogIn className="w-3.5 h-3.5" /> Clock in
          </button>
        )}
      </div>

      {/* Today's shifts */}
      {todayShifts.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle mb-2">Today</p>
          <div className="space-y-1.5">
            {todayShifts.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-fg font-semibold">{s.staff_name}</span>
                <span className="text-fg-muted tabular-nums">
                  {new Date(s.clock_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  {s.clock_out
                    ? ` – ${new Date(s.clock_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · ${minsToHm(shiftMinutes(s))}`
                    : ' – on shift'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commission rules (owner) */}
      {isOwner && (
        <div className="mb-4 pt-4 border-t border-line">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-3.5 h-3.5 text-fg-muted" />
            <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle">Commission — % of sales served</p>
          </div>
          {rules.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {rules.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="text-fg">{r.staff_name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-fg tabular-nums">{r.percent}%</span>
                    <button onClick={() => removeRule(r)} className="text-[11px] text-fg-subtle hover:text-negative" aria-label={`Remove commission for ${r.staff_name}`}>Edit</button>
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newRule.name}
              onChange={(e) => setNewRule((d) => ({ ...d, name: e.target.value }))}
              className="input-field flex-1 py-2 text-xs"
              placeholder="Staff name (as on bills)"
              aria-label="Staff name for commission"
            />
            <input
              type="number" min={0} max={100} value={newRule.percent}
              onChange={(e) => setNewRule((d) => ({ ...d, percent: e.target.value }))}
              className="input-field w-20 py-2 text-xs text-right tabular-nums"
              placeholder="%"
              aria-label="Commission percent"
            />
            <button onClick={saveRule} disabled={savingRule} className="btn-primary h-10 w-10 rounded-xl p-0 text-xs">
              {savingRule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* 30-day performance */}
      {performance.length > 0 && (
        <div className="pt-4 border-t border-line">
          <p className="text-[11px] font-bold uppercase tracking-wide text-fg-subtle mb-2">Last 30 days</p>
          <div className="space-y-3">
            {performance.map((p) => <details key={p.staffName} className="rounded-2xl bg-surface-2 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><div><p className="font-bold text-fg">{p.staffName}</p><p className="mt-1 text-xs text-fg-subtle">{p.orders} sales</p></div><div className="text-right"><p className="font-extrabold text-emerald-600">{formatINR(p.revenue, 0)}</p><p className="text-xs font-bold text-fg">Commission {p.commission > 0 ? formatINR(p.commission, 0) : '—'}</p></div></summary>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs text-fg-muted"><span>Hours<br /><b className="text-fg">{p.hoursWorked !== null ? `${p.hoursWorked}h` : '—'}</b></span><span>Rev/hr<br /><b className="text-fg">{p.revenuePerHour !== null ? formatINR(p.revenuePerHour, 0) : '—'}</b></span><span>Rate<br /><b className="text-fg">{p.commissionPercent > 0 ? `${p.commissionPercent}%` : '—'}</b></span></div>
            </details>)}
          </div>
          <p className="text-[11px] text-fg-subtle mt-2">
            Commission is an estimate from billed sales (the "served by" name on each bill) — settle actual payouts with your CA.
          </p>
        </div>
      )}
    </section>
  )
}
