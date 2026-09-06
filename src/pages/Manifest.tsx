import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { executeChangeRequest, denyChangeRequest } from '../lib/approvals'
import { buildManifest, manifestSummary, KIND_META, type ManifestItem } from '../lib/manifest'
import { formatINR } from '../lib/format'
import { MerajGlyph } from '../components/MerajDevice'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import { ArrowRight, Check, Loader2, X, ClipboardCheck, Zap, Bell, Package } from 'lucide-react'
import toast from 'react-hot-toast'

const KIND_ICON = { approval: ClipboardCheck, overdue: Bell, lowstock: Package } as const

/**
 * Meraj's Plan — the one-tap morning manifest. Everything Meraj has lined
 * up for the owner today: approvals, money to collect, stock to reorder.
 * The owner decides with one tap; Meraj has already done the thinking.
 */
export default function Manifest() {
  const { ownerId, profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<ManifestItem[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ briefing: true, recap: true, autoRemind: true, autoPo: true })

  // Standing orders — Meraj's automation policies (business_memory.preferences.autopilot)
  useEffect(() => {
    if (!ownerId) return
    supabase.from('business_memory').select('preferences').eq('user_id', ownerId).maybeSingle()
      .then(({ data }) => {
        const p = (data?.preferences as any)?.autopilot
        if (p) setPrefs({ briefing: p.briefing !== false, recap: p.recap !== false, autoRemind: p.autoRemind?.enabled !== false, autoPo: p.autoPo !== false })
      })
  }, [ownerId])

  const toggleAuto = async (key: 'briefing' | 'recap' | 'autoRemind' | 'autoPo') => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    const autopilot = { briefing: next.briefing, recap: next.recap, autoPo: next.autoPo, autoRemind: { enabled: next.autoRemind, daysAfterDue: 3 } }
    const { data: row } = await supabase.from('business_memory').select('preferences').eq('user_id', ownerId).maybeSingle()
    const merged = { ...((row?.preferences as any) || {}), autopilot }
    if (row) await supabase.from('business_memory').update({ preferences: merged, last_updated_at: new Date().toISOString() }).eq('user_id', ownerId)
    else await supabase.from('business_memory').insert({ user_id: ownerId, preferences: merged })
    toast.success('Meraj noted it')
  }

  const load = useCallback(async () => {
    if (!ownerId) return
    const [crRes, invRes, prodRes] = await Promise.all([
      supabase.from('change_requests').select('id, summary, requester_name, status').eq('user_id', ownerId).eq('status', 'pending'),
      supabase.from('invoices').select('id, invoice_number, client_name, total').eq('user_id', ownerId).eq('status', 'overdue'),
      supabase.from('products').select('id, name, stock_quantity, low_stock_threshold').eq('user_id', ownerId),
    ])
    const lowStock = (prodRes.data || []).filter(
      (p: any) => Number(p.stock_quantity ?? 0) <= Number(p.low_stock_threshold ?? 0),
    )
    setItems(
      buildManifest({
        approvals: (crRes.data as any[]) || [],
        overdue: (invRes.data as any[]) || [],
        lowStock: lowStock as any[],
      }),
    )
  }, [ownerId])

  useEffect(() => {
    if (ownerId) void load()
    else setItems([])
  }, [ownerId, load])

  const act = async (item: ManifestItem, deny = false) => {
    if (item.cta.kind === 'ask') {
      navigate(`/app/assistant?q=${encodeURIComponent(item.cta.query || '')}`)
      return
    }
    if (item.cta.kind === 'link') {
      navigate(item.cta.to || '/app')
      return
    }
    // approval — one tap executes inline
    setBusy(item.id)
    try {
      if (deny) {
        await denyChangeRequest(item.id.replace(/^cr-/, ''))
        toast.success('Declined')
      } else {
        await executeChangeRequest({ id: item.id.replace(/^cr-/, '') } as any)
        toast.success('Done — Meraj executed it')
      }
      setItems((prev) => (prev || []).filter((x) => x.id !== item.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not execute')
    } finally {
      setBusy(null)
    }
  }

  const summary = manifestSummary(items || [])
  const firstName = (profile?.full_name || 'boss').split(' ')[0]

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Meraj's Plan"
        subtitle="Your manager's morning line-up — every card is one tap."
        icon={<ClipboardCheck className="w-5 h-5" />}
      />

      {items === null ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Sab done, boss."
          description="Nothing needs your tap right now. Meraj is watching sales, stock and dues — the plan rebuilds itself the moment something needs you."
        />
      ) : (
        <>
          {/* Summary */}
          <div className="card p-4 mb-4 flex items-center gap-3">
            <MerajGlyph size={44} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-fg">
                {firstName}, {summary.count} thing{summary.count > 1 ? 's' : ''} need{summary.count > 1 ? '' : 's'} you today
                {summary.money > 0 && <> — <span className="text-warning">{formatINR(summary.money, 0)}</span> waiting to be collected</>}
              </p>
              <p className="text-xs text-fg-subtle">I ordered this by what can't wait. Tap a card's button — I'll handle the rest.</p>
            </div>
          </div>

          {/* The queue */}
          <div className="space-y-2.5">
            {items.map((item, i) => {
              const Icon = KIND_ICON[item.kind]
              const meta = KIND_META[item.kind]
              return (
                <div key={item.id} className="card card-hover p-4 flex items-center gap-3" style={{ animationDelay: `${i * 30}ms` }}>
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${meta.tone}`}>
                    <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-surface-2 text-fg-subtle">{meta.label}</span>
                    </div>
                    <p className="text-sm font-bold text-fg truncate mt-0.5">{item.title}</p>
                    <p className="text-xs text-fg-subtle truncate">{item.detail}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.cta.kind === 'approve' && (
                      <button
                        onClick={() => act(item, true)}
                        disabled={busy === item.id}
                        aria-label="Decline"
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-fg-subtle hover:text-negative hover:bg-negative/10 transition-colors"
                      >
                        {busy === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => act(item)}
                      disabled={busy === item.id}
                      className={`h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 ${
                        item.cta.kind === 'approve'
                          ? 'bg-accent-strong text-accent-fg hover:bg-accent'
                          : 'bg-secondary-soft text-secondary-strong border border-secondary/30 hover:border-secondary/60'
                      }`}
                    >
                      {busy === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : item.cta.kind === 'approve' ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                      {item.cta.label}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-[11px] text-fg-subtle mt-4">
            The plan rebuilds from live data every time you open it — approvals, overdue bills and stock alerts, ranked by what can't wait.
          </p>
        </>
      )}

      {/* Standing orders — hire the manager */}
      <div className="card p-4 mt-6">
        <p className="section-title mb-3">Meraj's standing orders</p>
        <div className="space-y-2.5">
          {([
            ['briefing', 'Morning WhatsApp briefing', '08:00 — yesterday’s numbers + today’s plan, on your WhatsApp'],
            ['autoRemind', 'Auto-send payment reminders', '3 days after the due date, polite tone, max 5 a day'],
            ['autoPo', 'Auto-draft reorder POs', 'When stock hits your alert level, the draft PO is ready to send'],
            ['recap', 'Evening recap', '21:00 — what Meraj did today and what’s coming tomorrow'],
          ] as const).map(([k, t, d]) => (
            <button key={k} onClick={() => toggleAuto(k)} className="w-full flex items-center justify-between gap-3 text-left py-1.5" role="switch" aria-checked={prefs[k]} aria-label={t}>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-fg">{t}</span>
                <span className="block text-xs text-fg-subtle">{d}</span>
              </span>
              <span className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors flex-shrink-0 ${prefs[k] ? 'bg-accent-strong' : 'bg-line-2'}`}>
                <span className={`w-5 h-5 rounded-full bg-surface shadow transition-transform ${prefs[k] ? 'translate-x-5' : ''}`} />
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-fg-subtle mt-3">Briefing &amp; recap go to your WhatsApp number (set it in Settings if empty). Reminders go to customers from your business number.</p>
      </div>
    </div>
  )
}
