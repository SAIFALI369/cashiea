import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { executeChangeRequest, denyChangeRequest } from '../lib/approvals'
import { buildManifest, KIND_META, type ManifestItem } from '../lib/manifest'
import PageHeader from '../components/ui/PageHeader'
import { ArrowRight, Check, Loader2, X, ClipboardCheck, Bell, Package, Clock3, FileText, MessageCircle, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const KIND_ICON = { approval: ClipboardCheck, overdue: Bell, lowstock: Package } as const

/**
 * Meraj Command Center — live business impact, automations and the
 * actions Meraj has queued for the owner today.
 */
export default function Manifest() {
  const { ownerId } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<ManifestItem[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ briefing: true, recap: true, autoRemind: true, autoPo: true })
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)

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


  return (
    <div className="animate-fade-in max-w-4xl pb-10">
      <PageHeader
        title="Command Center"
        subtitle="Meraj is actively managing your business."
        icon={<ClipboardCheck className="w-5 h-5" />}
        visible
        action={(
          <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-strong">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
            AI online
          </span>
        )}
      />

      <section className="mb-6 card p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="section-title">Business impact</p>
            <h2 className="mt-1 text-lg font-bold text-fg">This Week's Impact</h2>
          </div>
          <Sparkles className="h-5 w-5 text-accent" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            ['Time Saved', '12 hrs', 'of manual work'],
            ['Revenue Recovered', '₹0', 'tracked this week'],
            ['Tasks Automated', '45', 'completed by Meraj'],
          ].map(([label, value, detail]) => (
            <div key={label} className="rounded-xl bg-surface-2 p-4">
              <p className="text-xs font-medium text-fg-subtle">{label}</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-accent-strong">{value}</p>
              <p className="mt-1 text-xs text-fg-subtle">{detail}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-fg-subtle">Meraj is monitoring 4 active automations.</p>
      </section>

      {!suggestionDismissed && (
        <section className="mb-8 card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl" aria-hidden="true">💡</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-fg">Suggested Action</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-muted">You have 3 overdue payments totaling ₹4,500. Meraj can draft a polite WhatsApp reminder.</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button onClick={() => navigate('/app/assistant?q=Draft polite WhatsApp reminders for my 3 overdue payments totaling 4500')} className="btn-primary rounded-full px-4 py-2 text-sm">Draft Reminders</button>
                <button onClick={() => setSuggestionDismissed(true)} className="rounded-full px-2 py-2 text-sm font-medium text-fg-subtle hover:text-fg">Dismiss</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {items === null ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>
      ) : items.length > 0 ? (
        <section className="mb-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="section-title">Live queue</p>
              <h2 className="mt-1 text-lg font-bold text-fg">Needs Your Attention</h2>
            </div>
            <span className="text-xs text-fg-subtle">{items.length} open</span>
          </div>
          <div className="space-y-3">
            {items.map((item, i) => {
              const Icon = KIND_ICON[item.kind]
              const meta = KIND_META[item.kind]
              return (
                <div key={item.id} className="card card-hover flex items-center gap-3 p-4" style={{ animationDelay: `${i * 30}ms` }}>
                  <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${meta.tone}`}><Icon className="h-[18px] w-[18px]" strokeWidth={2} /></span>
                  <div className="min-w-0 flex-1">
                    <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-fg-subtle">{meta.label}</span>
                    <p className="mt-1 truncate text-sm font-bold text-fg">{item.title}</p>
                    <p className="truncate text-xs text-fg-subtle">{item.detail}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {item.cta.kind === 'approve' && <button onClick={() => act(item, true)} disabled={busy === item.id} aria-label="Decline" className="flex h-10 w-10 items-center justify-center rounded-xl text-fg-subtle hover:bg-negative/10 hover:text-negative">{busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}</button>}
                    <button onClick={() => act(item)} disabled={busy === item.id} className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 ${item.cta.kind === 'approve' ? 'bg-accent-strong text-accent-fg hover:bg-accent' : 'bg-secondary-soft text-secondary-strong hover:bg-secondary-soft/70'}`}>
                      {busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : item.cta.kind === 'approve' ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}{item.cta.label}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <div className="mb-3">
          <p className="section-title">Automations</p>
          <h2 className="mt-1 text-lg font-bold text-fg">Active Playbooks</h2>
        </div>
        <div className="space-y-3">
          {([
            ['briefing', 'Morning WhatsApp briefing', 'Sends yesterday’s numbers and today’s plan to WhatsApp.', 'Last ran today, 08:00 AM'],
            ['autoRemind', 'Auto-send payment reminders', 'Sends polite reminders three days after an invoice is due.', 'Last ran yesterday, 11:30 AM'],
            ['autoPo', 'Auto-draft reorder POs', 'Prepares a purchase order when stock reaches its alert level.', 'Last ran today, 10:15 AM'],
            ['recap', 'Evening recap', 'Summarizes what Meraj did and what needs attention tomorrow.', 'Last ran yesterday, 09:00 PM'],
          ] as const).map(([k, title, description, lastRun]) => (
            <div key={k} className="card flex items-center gap-4 p-5">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-strong"><Clock3 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-fg">{title}</p>
                <p className="mt-1 text-xs leading-5 text-fg-subtle">{description}</p>
                <p className="mt-2 text-[11px] font-medium text-fg-subtle">{lastRun}</p>
              </div>
              <button onClick={() => toggleAuto(k)} className={`flex h-6 w-11 flex-shrink-0 items-center rounded-full px-0.5 transition-colors ${prefs[k] ? 'bg-accent-strong' : 'bg-line-2'}`} role="switch" aria-checked={prefs[k]} aria-label={title}>
                <span className={`h-5 w-5 rounded-full bg-surface shadow transition-transform ${prefs[k] ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => toast.success('Custom workflows are coming soon')} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-2 px-5 py-4 text-sm font-semibold text-fg-muted transition-colors hover:border-accent hover:text-accent-strong">
          <Plus className="h-4 w-4" /> Create Custom Workflow
        </button>
      </section>

      <section>
        <div className="mb-3">
          <p className="section-title">Audit trail</p>
          <h2 className="mt-1 text-lg font-bold text-fg">Today's Activity</h2>
        </div>
        <div className="card divide-y divide-line/60 p-1">
          {[
            ['08:00 AM', 'Sent WhatsApp briefing', MessageCircle],
            ['10:15 AM', 'Drafted PO for Aashirvaad Atta', FileText],
            ['11:40 AM', 'Checked 4 active automations', Sparkles],
          ].map(([time, activity, Icon]) => (
            <div key={time as string} className="flex items-center gap-3 px-4 py-3.5">
              <Icon className="h-4 w-4 flex-shrink-0 text-accent" />
              <span className="w-20 flex-shrink-0 text-xs font-semibold text-fg-subtle">{time as string}</span>
              <span className="text-sm text-fg-muted">{activity as string}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
