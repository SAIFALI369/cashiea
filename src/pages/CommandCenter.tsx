import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip, type StatTile } from '../components/ui/StatStrip'
import { StatusPill } from '../components/ui/StatusPill'
import EmptyState from '../components/ui/EmptyState'
import {
  DEFAULT_CONFIG, RULE_META, relTime, runAutomationNow, sparklinePath, undoAutomationEvent,
  type AutomationEvent, type AutomationRule, type AutomationType,
} from '../lib/automation'
import { Activity, Bot, Check, IndianRupee, Loader2, Play, Save, ShieldCheck, Undo2, Zap, Settings, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

/**
 * Command Center — the autonomy cockpit.
 * Every autonomous action Cashiea takes, with receipts, guardrails and undo.
 */

const SEV_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  success: 'success', info: 'info', warning: 'warning', critical: 'danger',
}

export default function CommandCenter() {
  const { ownerId } = useAuth()
  const { isOwner } = useCan()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<AutomationEvent[]>([])
  const [rules, setRules] = useState<Record<string, AutomationRule>>({})
  const [savingRule, setSavingRule] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [undoing, setUndoing] = useState<string | null>(null)
  const [editingType, setEditingType] = useState<AutomationType | null>(null)

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    ;(async () => {
      const [ev, ru] = await Promise.all([
        supabase.from('automation_events').select('*').eq('user_id', ownerId)
          .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
          .order('created_at', { ascending: false }).limit(60),
        supabase.from('automation_rules').select('type,enabled,config,last_run_at').eq('user_id', ownerId),
      ])
      if (cancelled) return
      setEvents((ev.data as AutomationEvent[]) || [])
      const merged: Record<string, AutomationRule> = {}
      for (const t of Object.keys(RULE_META) as AutomationType[]) {
        const row = (ru.data || []).find((r) => r.type === t)
        merged[t] = {
          type: t,
          enabled: row ? row.enabled !== false : true,
          config: { ...DEFAULT_CONFIG[t], ...((row?.config as Record<string, number>) || {}) },
          last_run_at: row?.last_run_at || null,
        }
      }
      setRules(merged)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const weekAgo = Date.now() - 7 * 86400000
  const weekEvents = events.filter((e) => new Date(e.created_at).getTime() > weekAgo)
  const stats = useMemo<StatTile[]>(() => ([
    { label: 'Actions (7d)', value: String(weekEvents.length), icon: Zap, tone: weekEvents.length ? 'accent' : 'default' },
    { label: 'Money in motion', value: `₹${Math.round(weekEvents.reduce((s, e) => s + Math.abs(Number(e.money_impact) || 0), 0) / 1000)}k`, icon: IndianRupee, tone: 'default' },
    { label: 'Rules active', value: `${Object.values(rules).filter((r) => r.enabled).length}/${Object.keys(RULE_META).length}`, icon: ShieldCheck, tone: 'positive' },
    { label: 'Undo available', value: String(events.filter((e) => e.undo_kind && !e.undone).length), icon: Undo2, tone: 'warning' },
  ]), [weekEvents, rules, events])

  // 14-day micro-chart of daily action counts
  const spark = useMemo(() => {
    const days = Array.from({ length: 14 }, () => 0)
    for (const e of events) {
      const d = Math.floor((Date.now() - new Date(e.created_at).getTime()) / 86400000)
      if (d >= 0 && d < 14) days[13 - d]++
    }
    return days
  }, [events])

  const saveRule = useCallback(async (type: AutomationType) => {
    if (!ownerId) return
    const r = rules[type]
    setSavingRule(type)
    const { error } = await supabase.from('automation_rules').upsert(
      { user_id: ownerId, type, enabled: r.enabled, config: r.config },
      { onConflict: 'user_id,type' },
    )
    setSavingRule(null)
    if (error) toast.error(error.message)
    else toast.success('Guardrails saved')
  }, [ownerId, rules])

  const toggleRule = (type: AutomationType) => {
    setRules((rs) => ({ ...rs, [type]: { ...rs[type], enabled: !rs[type].enabled } }))
  }
  const setCfg = (type: AutomationType, key: string, value: number) => {
    setRules((rs) => ({ ...rs, [type]: { ...rs[type], config: { ...rs[type].config, [key]: value } } }))
  }

  const runNow = async () => {
    setRunning(true)
    const r = await runAutomationNow()
    setRunning(false)
    if (r.ok) toast.success(`Checks complete — ${r.ran?.length ?? 0} departments ran`)
    else toast.error(r.error || 'Run failed')
    if (r.ok && ownerId) {
      const { data } = await supabase.from('automation_events').select('*').eq('user_id', ownerId)
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false }).limit(60)
      setEvents((prev) => {
        const ids = new Set(prev.map((e) => e.id))
        return [...(data || []), ...prev.filter((e) => !ids.has(e.id))].slice(0, 60)
      })
    }
  }

  const undo = async (id: string) => {
    setUndoing(id)
    const r = await undoAutomationEvent(id)
    setUndoing(null)
    if (r.ok) {
      toast.success('Undone')
      setEvents((es) => es.map((e) => (e.id === id ? { ...e, undone: true } : e)))
    } else toast.error(r.error || 'Could not undo')
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="command-center-page animate-fade-in">
      <PageHeader
        title="Command Center"
        subtitle="Every action Cashiea takes on its own — with receipts, guardrails and undo."
        icon={<Bot className="w-5 h-5" />}
        visible
      />

      <StatStrip stats={stats} />

      {/* ── Autonomy cockpit: micro-chart + run now ── */}
      <div className="card mb-5 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Runs automatically every 30 minutes</p>
            <svg viewBox="0 0 120 32" className="mt-2 h-10 w-full max-w-[220px]" preserveAspectRatio="none" aria-hidden>
              <path d={sparklinePath(spark)} fill="none" stroke="rgb(var(--accent-strong))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-right">
            <button onClick={runNow} disabled={running || !isOwner} className="btn-primary text-sm">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run checks now
            </button>
            <p className="mt-1.5 text-[11px] text-fg-subtle">Money and inventory checks stay on schedule.</p>
          </div>
        </div>
      </div>

      {/* ── Departments & guardrails ── */}
      <h2 className="section-title">Departments</h2>
      <div className="space-y-3 mb-6">
        {(Object.keys(RULE_META) as AutomationType[]).map((t) => {
          const meta = RULE_META[t]
          const rule = rules[t]
          return (
            <div key={t} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-fg">{meta.label}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-surface-2 text-fg-subtle px-2 py-0.5">{meta.department}</span>
                    {rule.last_run_at && <span className="text-[11px] text-fg-subtle">· ran {relTime(rule.last_run_at)}</span>}
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">{meta.tagline}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={rule.enabled}
                  aria-label={`${meta.label} ${rule.enabled ? 'on' : 'off'}`}
                  onClick={() => toggleRule(t)}
                  className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors', rule.enabled ? 'bg-accent' : 'bg-line-2')}
                >
                  <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', rule.enabled ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
              <div className="mt-4 space-y-4">
                {meta.guardrails.map((g) => <div key={g.key} className="flex items-center justify-between gap-3"><span className="text-sm text-fg-muted">{g.label}</span><span className="font-bold text-fg tabular-nums">{rule.config[g.key] ?? 0}{g.key.toLowerCase().includes('days') || g.label.toLowerCase().includes('days') ? ' days' : g.key.toLowerCase().includes('value') || g.label.toLowerCase().includes('value') ? '' : ''}</span></div>)}
              </div>
              <div className="mt-4 flex justify-end"><button onClick={() => setEditingType(t)} disabled={!isOwner} className="inline-flex items-center gap-1.5 text-xs font-semibold text-fg-muted hover:text-accent-strong"><Settings className="h-3.5 w-3.5" /> Edit Settings</button></div>
            </div>
          )
        })}
      </div>

      {editingType && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={() => setEditingType(null)} role="dialog" aria-label="Edit automation settings"><div className="card w-full rounded-b-none p-5 sm:max-w-lg sm:rounded-[20px]" onClick={(event) => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-bold text-fg">Edit Settings</h2><button onClick={() => setEditingType(null)} className="text-fg-subtle"><X className="h-5 w-5" /></button></div><div className="space-y-4">{RULE_META[editingType].guardrails.map((g) => <label key={g.key} className="block"><span className="label">{g.label}</span><input type="number" min={g.min} max={g.max} value={rules[editingType].config[g.key] ?? 0} onChange={(e) => setCfg(editingType, g.key, Math.min(g.max, Math.max(g.min, Number(e.target.value) || 0)))} className="input-field" /></label>)}</div><button onClick={() => { void saveRule(editingType); setEditingType(null) }} className="btn-primary mt-5 w-full rounded-full py-3">Save Settings</button></div></div>}

      {/* ── Action feed ── */}
      <h2 className="section-title">Action log</h2>
      {events.length === 0 ? (
        <div className="relative ml-2 border-l-2 border-line-2 py-5 pl-6"><span className="absolute -left-[7px] top-7 h-3 w-3 rounded-full bg-accent" /><p className="font-bold text-fg">Cashiea hasn't needed to act yet</p><p className="mt-1 text-sm leading-6 text-fg-muted">When stock runs low, customers go quiet, or cash needs watching, actions appear here automatically — with receipts.</p></div>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <div key={e.id} className={clsx('card p-4', e.undone && 'opacity-55')}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-fg">{e.title}</p>
                    <StatusPill tone={SEV_TONE[e.severity] || 'info'}>{e.severity}</StatusPill>
                    {e.undone && <StatusPill tone="offline">undone</StatusPill>}
                  </div>
                  {e.body && <p className="mt-1 text-xs text-fg-muted leading-relaxed">{e.body}</p>}
                  <p className="mt-1.5 text-[11px] text-fg-subtle">
                    {relTime(e.created_at)}
                    {e.money_impact > 0 && <span className="tabular-nums font-semibold text-fg"> · ₹{Math.round(e.money_impact).toLocaleString('en-IN')}</span>}
                  </p>
                </div>
                {e.undo_kind && !e.undone && isOwner && (
                  <button onClick={() => undo(e.id)} disabled={undoing === e.id} className="btn-secondary !py-1.5 text-xs shrink-0">
                    {undoing === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
                    Undo
                  </button>
                )}
                {e.undone && <Check className="h-4 w-4 text-positive shrink-0 mt-1" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
