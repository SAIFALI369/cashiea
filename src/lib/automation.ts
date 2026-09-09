import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, edgeFunctionUrl } from './supabase'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

/**
 * automation.ts — the Command Center client.
 *
 * Cashiea's autonomous actions land in `automation_events` (written by the
 * automation-engine edge function, service-role only). This lib gives the
 * app: rule metadata + defaults, undo/run APIs, a sparkline micro-chart
 * builder, and the `useAutomationCards` hook that pops "Action taken by
 * Cashiea" cards in real time.
 */

export type AutomationType = 'self_order' | 'churn_winback' | 'ar_escalation' | 'cash_runway' | 'expiry_guard'
export type Severity = 'info' | 'success' | 'warning' | 'critical'

export interface AutomationEvent {
  id: string
  user_id?: string
  type: AutomationType
  title: string
  body: string | null
  severity: Severity
  money_impact: number
  receipt: Record<string, unknown>
  undo_kind: string | null
  undo_ref: string | null
  undone: boolean
  created_at: string
}

export interface AutomationRule {
  type: AutomationType
  enabled: boolean
  config: Record<string, number>
  last_run_at: string | null
}

/** Must stay in sync with supabase/functions/automation-engine/index.ts RULES */
export const DEFAULT_CONFIG: Record<AutomationType, Record<string, number>> = {
  self_order: { maxOrderValue: 15000, leadDays: 3, coverDays: 7 },
  churn_winback: { dormantDays: 45, discountPercent: 20, maxPerDay: 3 },
  ar_escalation: { friendlyDays: 3, firmDays: 10, finalDays: 21, maxPerDay: 5 },
  cash_runway: { horizonDays: 7 },
  expiry_guard: { daysAhead: 3 },
}

export const RULE_META: Record<AutomationType, {
  label: string
  tagline: string
  department: string
  guardrails: { key: string; label: string; suffix?: string; min: number; max: number }[]
}> = {
  self_order: {
    label: 'Self-ordering supply chain',
    tagline: 'Velocity-sized POs placed on their own when stock runs out — undoable.',
    department: 'Procurement',
    guardrails: [
      { key: 'maxOrderValue', label: 'Max auto-order value', suffix: '₹', min: 500, max: 200000 },
      { key: 'leadDays', label: 'Supplier lead time', suffix: 'days', min: 0, max: 30 },
      { key: 'coverDays', label: 'Days of cover', suffix: 'days', min: 1, max: 60 },
    ],
  },
  churn_winback: {
    label: 'Churn alarm & win-back',
    tagline: 'Dormant customers get a personalised offer based on what they loved.',
    department: 'Marketing',
    guardrails: [
      { key: 'dormantDays', label: 'Dormant after', suffix: 'days', min: 7, max: 180 },
      { key: 'discountPercent', label: 'Offer discount', suffix: '%', min: 0, max: 50 },
      { key: 'maxPerDay', label: 'Max messages / day', min: 1, max: 20 },
    ],
  },
  ar_escalation: {
    label: 'Self-healing receivables',
    tagline: 'Reminders escalate friendly → firm → final, with a split-payment offer at the end.',
    department: 'CFO',
    guardrails: [
      { key: 'friendlyDays', label: 'First nudge after', suffix: 'days late', min: 1, max: 60 },
      { key: 'firmDays', label: 'Firm tone at', suffix: 'days late', min: 2, max: 90 },
      { key: 'finalDays', label: 'Final notice at', suffix: 'days late', min: 5, max: 120 },
      { key: 'maxPerDay', label: 'Max reminders / day', min: 1, max: 20 },
    ],
  },
  cash_runway: {
    label: 'Predictive cash runway',
    tagline: 'Sees a cash gap days before it hurts and tells you exactly what to do.',
    department: 'CFO',
    guardrails: [
      { key: 'horizonDays', label: 'Look-ahead window', suffix: 'days', min: 3, max: 30 },
    ],
  },
  expiry_guard: {
    label: 'Expiry guardian',
    tagline: 'Bundles expiring stock with your highest-margin item before it becomes waste.',
    department: 'Procurement',
    guardrails: [
      { key: 'daysAhead', label: 'Warn before expiry', suffix: 'days', min: 1, max: 14 },
    ],
  },
}

/** Escalation tone for a given lateness (mirrors the engine + habitual flag). */
export function toneForDaysLate(
  daysLate: number,
  cfg: { friendlyDays: number; firmDays: number; finalDays: number },
  habitual = false,
): 'friendly' | 'firm' | 'final' {
  if (daysLate >= cfg.finalDays) return 'final'
  if (daysLate >= cfg.firmDays || habitual) return 'firm'
  return 'friendly'
}

/** Minimal SVG sparkline path for micro-charts. */
export function sparklinePath(values: number[], w = 120, h = 32): string {
  if (!values.length) return ''
  const max = Math.max(...values, 1)
  const step = values.length > 1 ? w / (values.length - 1) : 0
  const y = (v: number) => h - 2 - (v / max) * (h - 4)
  return values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
}

export function relTime(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

// ── Engine APIs ──
export async function undoAutomationEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Sign in first' }
  const res = await fetch(`${edgeFunctionUrl('automation-engine')}?job=undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ event_id: eventId }),
  })
  const data = await res.json().catch(() => ({}))
  return res.ok && data?.ok ? { ok: true } : { ok: false, error: data?.error || `Failed (${res.status})` }
}

export async function runAutomationNow(): Promise<{ ok: boolean; ran?: string[]; error?: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'Sign in first' }
  const res = await fetch(`${edgeFunctionUrl('automation-engine')}?job=run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: '{}',
  })
  const data = await res.json().catch(() => ({}))
  return res.ok ? { ok: true, ran: data?.ran } : { ok: false, error: data?.error || `Failed (${res.status})` }
}

// ── Live notification cards ──
const SEEN_KEY = 'cashiea_auto_cards_seen'
const DISMISSED_KEY = 'cashiea_auto_cards_dismissed'

function loadSet(key: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) } catch { return new Set() }
}
function saveSet(key: string, set: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...set].slice(-200))) } catch { /* ignore */ }
}

/**
 * useAutomationCards — realtime "Action taken by Cashiea" cards.
 * Shows fresh events (and live inserts) the owner hasn't dismissed.
 */
export function useAutomationCards(ownerId: string | null | undefined) {
  const [cards, setCards] = useState<AutomationEvent[]>([])
  const dismissed = useRef<Set<string>>(loadSet(DISMISSED_KEY))
  const firstLoad = useRef(true)

  const dismiss = useCallback((id: string) => {
    dismissed.current.add(id)
    saveSet(DISMISSED_KEY, dismissed.current)
    setCards((c) => c.filter((x) => x.id !== id))
  }, [])

  const admit = useCallback((events: AutomationEvent[]) => {
    const cutoff = Date.now() - 15 * 60 * 1000
    setCards(events.filter((e) =>
      !dismissed.current.has(e.id) && !e.undone && new Date(e.created_at).getTime() > cutoff,
    ).slice(0, 3))
  }, [])

  useEffect(() => {
    if (!ownerId) return
    let seenAt = Number(localStorage.getItem(SEEN_KEY) || 0)
    if (firstLoad.current) {
      // First mount ever: don't replay history — mark now as seen.
      if (!seenAt) { seenAt = Date.now(); localStorage.setItem(SEEN_KEY, String(seenAt)) }
      firstLoad.current = false
    }

    (async () => {
      const { data } = await supabase.from('automation_events')
        .select('*').eq('user_id', ownerId)
        .gte('created_at', new Date(Date.now() - 2 * 3600 * 1000).toISOString())
        .order('created_at', { ascending: false }).limit(10)
      admit((data as AutomationEvent[]) || [])
    })()

    const channel = supabase
      .channel('automation-events')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'automation_events' },
        (payload: RealtimePostgresChangesPayload<AutomationEvent>) => {
          const e = payload.new as AutomationEvent
          if (!e || e.user_id !== ownerId || dismissed.current.has(e.id)) return
          setCards((c) => [e, ...c].slice(0, 3))
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [ownerId, admit])

  return { cards, dismiss }
}
