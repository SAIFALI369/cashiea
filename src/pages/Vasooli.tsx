import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase, edgeFunctionUrl } from '../lib/supabase'
import PageHeader from '../components/ui/PageHeader'
import { StatStrip } from '../components/ui/StatStrip'
import EmptyState from '../components/ui/EmptyState'
import {
  prepareVasooliRound, vasooliSummary,
  type VasooliDebt, type VasooliDraft, type VasooliLanguage,
} from '../lib/vasooli'
import { IndianRupee, Loader2, Pause, PauseCircle, Play, Send, ShieldAlert, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

/**
 * Vasooli Round — Meraj's collection round.
 * Draft list → per-customer preview (tier + language + UPI link) →
 * owner confirms → one bulk WhatsApp send. Never sends blind, and the
 * owner can pause any customer ("don't chase Sharma ji yet").
 * Khata Guard rides along: chronic late-payers get a number + reason
 * warning on their card, not a bare red flag.
 */

const TIER_TONE: Record<string, string> = {
  soft: 'bg-positive/10 text-positive',
  factual: 'bg-info/10 text-info',
  direct: 'bg-negative/10 text-negative',
}
const LANGS: { id: VasooliLanguage; label: string }[] = [
  { id: 'hinglish', label: 'Hinglish' },
  { id: 'hindi', label: 'हिंदी' },
  { id: 'bhojpuri', label: 'भोजपुरी' },
  { id: 'english', label: 'English' },
]

interface KhataSignal { timesLate15: number; avgDaysToClear: number; safeCap: number }

export default function Vasooli() {
  const { ownerId, profile } = useAuth()
  const { isOwner } = useCan()
  const [loading, setLoading] = useState(true)
  const [debts, setDebts] = useState<VasooliDebt[]>([])
  const [paused, setPaused] = useState<{ id: string; name: string }[]>([])
  const [langById, setLangById] = useState<Record<string, VasooliLanguage>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [khata, setKhata] = useState<Record<string, KhataSignal>>({})
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    ;(async () => {
      const monthAgo = new Date(Date.now() - 90 * 86400000).toISOString()
      const [inv, cust] = await Promise.all([
        supabase.from('invoices').select('id,invoice_number,client_name,client_phone,total,due_date,status,paid_at')
          .eq('user_id', ownerId).eq('status', 'overdue').not('client_phone', 'is', null).limit(100),
        supabase.from('customers').select('id,name,phone,language,chase_paused').eq('user_id', ownerId).limit(1000),
      ])
      if (cancelled) return
      const customers = (cust.data || []) as any[]
      const byPhone = new Map(customers.filter((c) => c.phone).map((c) => [String(c.phone).replace(/\D/g, '').slice(-10), c]))

      // Aggregate overdue bills per customer (biggest days-overdue wins)
      const map = new Map<string, VasooliDebt>()
      for (const i of (inv.data || []) as any[]) {
        const key = String(i.client_phone || '').replace(/\D/g, '').slice(-10) || i.client_name
        const days = i.due_date ? Math.max(1, Math.floor((Date.now() - new Date(i.due_date).getTime()) / 86400000)) : 1
        const c = byPhone.get(key)
        const prev = map.get(key)
        map.set(key, {
          customerId: c?.id || `phone-${key}`,
          customerName: c?.name || i.client_name || 'Customer',
          phone: String(i.client_phone),
          amount: (prev?.amount || 0) + Number(i.total || 0),
          daysOverdue: Math.max(prev?.daysOverdue || 0, days),
          invoiceNumbers: [...(prev?.invoiceNumbers || []), i.invoice_number].slice(0, 5),
        })
      }

      // Khata Guard: per-customer payment history (paid + overdue, last 90 days)
      const phones = [...map.keys()]
      const khataMap: Record<string, KhataSignal> = {}
      if (phones.length) {
        const { data: hist } = await supabase.from('invoices')
          .select('client_phone,due_date,paid_at,status,total')
          .eq('user_id', ownerId).not('due_date', 'is', null).gte('due_date', monthAgo.slice(0, 10)).limit(500)
        const byClient = new Map<string, any[]>()
        for (const h of (hist || []) as any[]) {
          const k = String(h.client_phone || '').replace(/\D/g, '').slice(-10)
          if (!phones.includes(k)) continue
          byClient.set(k, [...(byClient.get(k) || []), h])
        }
        for (const k of phones) {
          const rows = byClient.get(k) || []
          let late15 = 0; let clearSum = 0; let clearN = 0; let totalSum = 0
          for (const r of rows) {
            totalSum += Number(r.total || 0)
            if (r.status === 'paid' && r.paid_at && r.due_date) {
              const dt = Math.floor((new Date(r.paid_at).getTime() - new Date(r.due_date).getTime()) / 86400000)
              if (dt > 15) late15++
              clearSum += Math.max(0, dt); clearN++
            } else if (r.status === 'overdue' && r.due_date) {
              if (Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86400000) > 15) late15++
            }
          }
          khataMap[k] = {
            timesLate15: late15,
            avgDaysToClear: clearN ? Math.round(clearSum / clearN) : 0,
            safeCap: rows.length ? Math.max(500, Math.round((totalSum / rows.length) / 100) * 100) : 0,
          }
        }
      }

      setDebts([...map.values()])
      setKhata(khataMap)
      setPaused(customers.filter((c) => c.chase_paused).map((c) => ({ id: c.id, name: c.name })))
      const langs: Record<string, VasooliLanguage> = {}
      for (const c of customers) if (c.language) langs[c.id] = c.language
      setLangById(langs)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const drafts = useMemo(() => prepareVasooliRound(debts, {
    shopName: profile?.company_name || profile?.full_name || 'My Business',
    ownerName: (profile?.full_name || 'Owner').split(' ')[0],
    upiId: profile?.upi_id || '',
    skipCustomerIds: paused.map((p) => p.id),
    languageFor: (id) => langById[id],
  }), [debts, paused, langById, profile])

  useEffect(() => { setSelected(new Set(drafts.map((d) => d.customerId))) }, [drafts])

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const setLanguage = useCallback(async (draft: VasooliDraft, lang: VasooliLanguage) => {
    setLangById((m) => ({ ...m, [draft.customerId]: lang }))
    if (!draft.customerId.startsWith('phone-')) {
      const { error } = await supabase.from('customers').update({ language: lang }).eq('id', draft.customerId)
      if (error) toast.error('Could not save language — using it for this round anyway')
    }
  }, [])

  const pauseChase = async (draft: VasooliDraft) => {
    setPaused((p) => [...p, { id: draft.customerId, name: draft.customerName }])
    if (!draft.customerId.startsWith('phone-')) {
      const { error } = await supabase.from('customers').update({ chase_paused: true }).eq('id', draft.customerId)
      if (error) toast.error(error.message)
    }
  }
  const resumeChase = async (id: string) => {
    setPaused((p) => p.filter((x) => x.id !== id))
    await supabase.from('customers').update({ chase_paused: false }).eq('id', id)
  }

  const sendRound = async () => {
    const picks = drafts.filter((d) => selected.has(d.customerId))
    if (!picks.length) return
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sign in first')
      const res = await fetch(edgeFunctionUrl('whatsapp-send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ broadcast: picks.map((d) => ({ to: d.phone, message: d.message })) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Send failed (${res.status})`)
      const okCount = Array.isArray(data?.results) ? data.results.filter((r: any) => r?.ok).length : picks.length
      setSent(true)
      toast.success(`Vasooli round sent — ${okCount} of ${picks.length} delivered`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  const totalDue = drafts.reduce((s, d) => s + d.amount, 0)
  const guardFlags = Object.values(khata).filter((k) => k.timesLate15 >= 2).length

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Vasooli Round"
        subtitle="Meraj's collection round — every message shown to you before anything is sent."
        icon={<Wallet className="w-5 h-5" />}
        visible
      />

      <StatStrip stats={[
        { label: 'To collect', value: `₹${Math.round(totalDue).toLocaleString('en-IN')}`, icon: IndianRupee, tone: 'accent' },
        { label: 'Messages ready', value: String(drafts.length), icon: Send, tone: drafts.length ? 'positive' : 'default' },
        { label: 'Khata Guard flags', value: String(guardFlags), icon: ShieldAlert, tone: guardFlags ? 'warning' : 'default' },
        { label: 'Paused', value: String(paused.length), icon: PauseCircle, tone: 'secondary' },
      ]} />

      {!profile?.upi_id && drafts.length > 0 && (
        <p className="text-xs text-fg-subtle mb-4">Add your UPI ID in Settings so every message carries a working payment link.</p>
      )}

      {drafts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={paused.length ? 'Everyone pausable is paused or settled' : 'Nothing to collect'}
          description={paused.length
            ? `All clear — ${paused.length} customer${paused.length === 1 ? '' : 's'} paused from chasing, the rest settled.`
            : 'No customer has dues right now. When bills go overdue, Meraj prepares the round here automatically.'}
        />
      ) : (
        <>
          <div className="space-y-2 mb-4">
            {drafts.map((d) => {
              const guard = khata[String(d.phone).replace(/\D/g, '').slice(-10)]
              const risky = guard && guard.timesLate15 >= 2
              return (
                <div key={d.customerId} className={clsx('card p-4', !selected.has(d.customerId) && 'opacity-55')}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selected.has(d.customerId)}
                      onChange={() => toggle(d.customerId)}
                      className="mt-1.5 w-4 h-4 accent-[rgb(var(--accent-strong))]"
                      aria-label={`Include ${d.customerName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-fg">{d.customerName}</p>
                        <span className={clsx('text-[10px] font-bold px-1.5 py-0.5 rounded-full', TIER_TONE[d.tier])}>{d.tier}</span>
                        <span className="text-[11px] text-fg-subtle">{d.daysOverdue} din se baaki</span>
                        <span className="ml-auto text-sm font-bold text-fg tabular-nums">₹{Math.round(d.amount).toLocaleString('en-IN')}</span>
                      </div>
                      {risky && (
                        <p className="mt-1.5 text-[11px] leading-relaxed text-negative font-medium">
                          Khata Guard: {d.customerName} ne pichhli {guard!.timesLate15} baar 15+ din liye hain (avg {guard!.avgDaysToClear} din) — agli baar ₹{guard!.safeCap.toLocaleString('en-IN')} se zyada udhaar mat dena.
                        </p>
                      )}
                      <p className="mt-2 text-[13px] text-fg-muted leading-relaxed whitespace-pre-wrap">{d.message}</p>
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        <select
                          value={d.language}
                          onChange={(e) => setLanguage(d, e.target.value as VasooliLanguage)}
                          className="input-field !py-1 !text-xs !w-auto"
                          aria-label={`Language for ${d.customerName}`}
                        >
                          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                        </select>
                        <button onClick={() => pauseChase(d)} className="btn-secondary !py-1 !text-xs" title="Don't chase this customer for now">
                          <Pause className="w-3 h-3" /> Don't chase yet
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="card p-4 sticky bottom-20 lg:bottom-24 z-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-xs text-fg-subtle">{vasooliSummary(drafts.filter((d) => selected.has(d.customerId)), paused.length)}</p>
              {sent ? (
                <p className="text-xs font-semibold text-positive sm:ml-auto">Round complete — receipts in WhatsApp log.</p>
              ) : (
                <button onClick={sendRound} disabled={sending || !isOwner || !selected.size} className="btn-primary text-sm sm:ml-auto">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send {selected.size} message{selected.size === 1 ? '' : 's'}
                </button>
              )}
            </div>
            {!isOwner && <p className="text-[11px] text-fg-subtle mt-2">Only the owner can send the round.</p>}
          </div>
        </>
      )}

      {paused.length > 0 && (
        <div className="card p-4 mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-2">Chase paused</p>
          <div className="flex flex-wrap gap-2">
            {paused.map((p) => (
              <button key={p.id} onClick={() => resumeChase(p.id)} className="btn-secondary !py-1 !text-xs" title="Resume chasing">
                <Play className="w-3 h-3" /> {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
