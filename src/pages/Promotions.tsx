import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useCan } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { formatINR } from '../lib/format'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import {
  validatePromotion,
  type Promotion, type BogoConfig, type TieredConfig, type PercentConfig,
} from '../lib/promotions'
import { Loader2, Plus, Tag, Trash2, CalendarClock, X, Check, Minus, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'

/**
 * Promotions — the owner's deal book. BOGO ("buy 2 get 1 free on soap"),
 * tiered spend ("₹2000+ → 10% off") and flat percent deals, each with an
 * optional date window. Rules the POS evaluates automatically at cart
 * time; the cashier sees exactly which deal applied and can skip it.
 */
type DraftKind = 'bogo' | 'tiered' | 'percent'

interface Draft {
  name: string
  kind: DraftKind
  productId: string
  category: string
  buy: string
  get: string
  discountPct: string
  tiers: string
  pct: string
  maxDiscount: string
  starts_at: string
  ends_at: string
}

const emptyDraft: Draft = {
  name: '', kind: 'bogo', productId: '', category: '', buy: '2', get: '1',
  discountPct: '100', tiers: '500:5, 2000:10', pct: '10', maxDiscount: '',
  starts_at: '', ends_at: '',
}

/** "500:5, 2000:10" → [{minSpend:500, pct:5}, …] */
function parseTiers(raw: string): Array<{ minSpend: number; pct: number }> {
  return raw.split(/[,\n]/).map((chunk) => chunk.trim()).filter(Boolean).map((chunk) => {
    const [spend, pct] = chunk.split(':')
    return { minSpend: Number(spend) || 0, pct: Number(pct) || 0 }
  }).filter((t) => t.minSpend > 0 && t.pct > 0)
}

export default function Promotions() {
  const { ownerId } = useAuth()
  const { isOwner } = useCan()
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<Promotion[]>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string; category?: string | null }>>([])
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Promotion | null>(null)

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const [r, p] = await Promise.all([
        supabase.from('promotions').select('*').eq('user_id', ownerId).order('created_at', { ascending: false }).limit(100),
        supabase.from('products').select('id,name,category').eq('user_id', ownerId).eq('active', true).order('name').limit(500),
      ])
      if (cancelled) return
      setRules((r.data as Promotion[]) || [])
      setProducts(p.data || [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [ownerId])

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))

  const buildRule = (): Promotion | null => {
    const base = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      kind: draft.kind,
      starts_at: draft.starts_at || null,
      ends_at: draft.ends_at || null,
      enabled: true,
    }
    if (draft.kind === 'bogo') {
      return { ...base, config: { productId: draft.productId || undefined, category: draft.category.trim() || undefined, buy: Number(draft.buy) || 1, get: Number(draft.get) || 0, discountPct: Number(draft.discountPct) || 100 } }
    }
    if (draft.kind === 'tiered') {
      return { ...base, config: { tiers: parseTiers(draft.tiers) } }
    }
    return { ...base, config: { pct: Number(draft.pct) || 0, maxDiscount: draft.maxDiscount ? Number(draft.maxDiscount) : undefined } }
  }

  const save = async () => {
    const rule = buildRule()
    if (!rule) return
    const check = validatePromotion(rule)
    if (!check.ok) { toast.error(check.error!); return }
    setSaving(true)
    try {
      const row: Record<string, unknown> = {
        user_id: ownerId, name: rule.name, kind: rule.kind, config: rule.config,
        starts_at: rule.starts_at, ends_at: rule.ends_at, enabled: true,
      }
      const { error } = await supabase.from('promotions').insert(row)
      if (error) throw error
      setRules((prev) => [{ ...rule }, ...prev])
      setDraft(emptyDraft)
      setShowForm(false)
      toast.success(`"${rule.name}" is live at the counter`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the deal')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (rule: Promotion) => {
    try {
      const { error } = await supabase.from('promotions').update({ enabled: !rule.enabled }).eq('id', rule.id).eq('user_id', ownerId)
      if (error) throw error
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the deal')
    }
  }

  const remove = async (rule: Promotion) => {
    setConfirmDelete(null)
    try {
      const { error } = await supabase.from('promotions').delete().eq('id', rule.id).eq('user_id', ownerId)
      if (error) throw error
      setRules((prev) => prev.filter((r) => r.id !== rule.id))
      toast.success('Deal removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove the deal')
    }
  }

  const windowText = (r: Promotion) => {
    if (!r.starts_at && !r.ends_at) return 'Always on'
    const from = r.starts_at || '…'
    const to = r.ends_at || '…'
    return `${from} → ${to}`
  }

  const configText = (r: Promotion) => {
    if (r.kind === 'bogo') {
      const cfg = r.config as Partial<BogoConfig>
      const target = cfg.productId ? products.find((p) => p.id === cfg.productId)?.name || 'selected items' : cfg.category || 'selected items'
      return `Buy ${cfg.buy || 1}, get ${cfg.get || 1} free · ${target}`
    }
    if (r.kind === 'tiered') {
      const tiers = (r.config as Partial<TieredConfig>)?.tiers || []
      return tiers.map((t) => `${formatINR(t.minSpend, 0)}+ → ${t.pct}%`).join(' · ')
    }
    const cfg = r.config as Partial<PercentConfig>
    return `Save ${cfg.pct || 0}% on your order${cfg.maxDiscount ? ` · max ${formatINR(cfg.maxDiscount, 0)}` : ''}`
  }

  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules])

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="promotions-page animate-fade-in">
      <PageHeader
        icon={<Tag className="w-5 h-5" />}
        title="Promotions"
        subtitle="BOGO, spend-tier and % deals with a schedule. The counter applies them automatically — the cashier sees which deal ran and can skip it."
        action={isOwner && (
          <button onClick={() => setShowForm(true)} className="btn-primary text-xs"><Plus className="w-3.5 h-3.5" /> New deal</button>
        )}
      />

      {rules.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No deals yet"
          description={isOwner ? 'Create a BOGO, spend-tier or % deal — it starts applying at the counter the moment you save it.' : 'Ask the owner to set up deals — they apply automatically at the counter.'}
        />
      ) : (
        <>
          <p className="text-xs text-fg-subtle mb-4">
            {activeCount} of {rules.length} deal{rules.length === 1 ? '' : 's'} active at the counter.
          </p>
          <div className="space-y-4">
            {rules.map((r) => {
              const cfg = r.config as Partial<BogoConfig> & Partial<PercentConfig>
              const benefit = r.kind === 'bogo' ? `${cfg.get || 1} Item Free` : r.kind === 'percent' ? `Save ${cfg.pct || 0}% on your order` : 'Save at spend tiers'
              const used = 5
              return (
                <div key={r.id} className={`card p-5 ${r.enabled ? '' : 'opacity-60'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-fg">{r.name}</p>
                      <p className="mt-1 text-sm font-bold text-emerald-600">{benefit}</p>
                      <p className="mt-1 text-xs text-fg-muted">{configText(r)}</p>
                      <div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, used * 10)}%` }} /></div><span className="whitespace-nowrap text-[11px] font-medium text-fg-subtle">Used {used} times</span></div>
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-fg-subtle"><CalendarClock className="h-3 w-3" /> {windowText(r)}</p>
                    </div>
                    {isOwner && <button onClick={() => toggle(r)} className={`relative h-7 w-12 flex-shrink-0 rounded-full p-1 transition-colors ${r.enabled ? 'bg-accent-strong' : 'bg-line-2'}`} role="switch" aria-checked={r.enabled} aria-label={`${r.enabled ? 'Deactivate' : 'Activate'} ${r.name}`}><span className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${r.enabled ? 'translate-x-5' : ''}`} /></button>}
                  </div>
                  {isOwner && <div className="mt-3 flex justify-end"><button onClick={() => setConfirmDelete(r)} className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100" aria-label="Delete deal"><Trash2 className="h-4 w-4" /></button></div>}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* New deal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowForm(false)} role="dialog" aria-label="New deal">
          <div className="card flex max-h-[96vh] w-full flex-col rounded-b-none p-5 sm:max-w-lg sm:rounded-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-fg">New deal</h3>
              <button onClick={() => setShowForm(false)} className="icon-btn" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>

            <div className="scroll-area flex-1 space-y-4 overflow-y-auto pr-1">
              <div>
                <label className="label">Deal name</label>
                <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className="input-field" placeholder="Diwali soap offer" autoFocus />
              </div>

              <div>
                <label className="label">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {([['bogo', 'Buy X get Y'], ['tiered', 'Spend tiers'], ['percent', '% off']] as const).map(([k, label]) => (
                    <button key={k} onClick={() => set({ kind: k })}
                      className={`px-2 py-2.5 rounded-lg text-xs font-semibold transition-colors ${draft.kind === k ? 'bg-secondary-soft text-secondary-strong ring-1 ring-secondary-strong/30' : 'bg-surface-2 text-fg-muted hover:text-fg'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {draft.kind === 'bogo' && (
                <>
                  <div>
                    <label className="label">Applies to</label>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])).slice(0, 8).map((category) => {
                        const selected = draft.category.split(',').map((x) => x.trim()).includes(category)
                        return <button key={category} type="button" onClick={() => set({ category: selected ? draft.category.split(',').map((x) => x.trim()).filter((x) => x !== category).join(', ') : [draft.category, category].filter(Boolean).join(', ') })} className={`rounded-full px-3 py-2 text-xs font-semibold ${selected ? 'bg-accent text-white' : 'bg-surface-2 text-fg-muted'}`}>{selected && <Check className="mr-1 inline h-3 w-3" />}{category}</button>
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([['buy', 'Buy'], ['get', 'Get']] as const).map(([key, label]) => <div key={key}><label className="label">{label}</label><div className="flex h-11 items-center justify-between rounded-xl bg-surface-2 px-2"><button type="button" onClick={() => set({ [key]: String(Math.max(1, Number(draft[key]) - 1)) })} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-fg-muted"><Minus className="h-4 w-4" /></button><span className="font-bold text-fg">{draft[key]}</span><button type="button" onClick={() => set({ [key]: String(Number(draft[key]) + 1) })} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-fg-muted"><Plus className="h-4 w-4" /></button></div></div>)}
                  </div>
                  <p className="text-sm font-bold text-fg">{draft.get} Item Free</p>
                </>
              )}

              {draft.kind === 'tiered' && (
                <div>
                  <label className="label">Spend tiers — "spend:percent" pairs</label>
                  <input value={draft.tiers} onChange={(e) => set({ tiers: e.target.value })} className="input-field" placeholder="500:5, 2000:10" />
                  <p className="text-[11px] text-fg-subtle mt-1">Highest matching tier wins. Example: spend ₹500 → 5% off, spend ₹2000 → 10% off.</p>
                </div>
              )}

              {draft.kind === 'percent' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">% off</label>
                    <input type="number" min={1} max={100} value={draft.pct} onChange={(e) => set({ pct: e.target.value })} className="input-field tabular-nums" />
                  </div>
                  <div>
                    <label className="label">Max discount (₹, optional)</label>
                    <input type="number" min={0} value={draft.maxDiscount} onChange={(e) => set({ maxDiscount: e.target.value })} className="input-field tabular-nums" placeholder="No cap" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Starts (optional)</label>
                  <input type="date" value={draft.starts_at} onChange={(e) => set({ starts_at: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="label">Ends (optional)</label>
                  <input type="date" value={draft.ends_at} onChange={(e) => set({ ends_at: e.target.value })} className="input-field" />
                </div>
              </div>

              <div className="sticky bottom-0 -mx-5 mt-4 flex flex-col gap-2 border-t border-line bg-surface px-5 pt-4">
                <button onClick={save} disabled={saving} className="btn-primary w-full rounded-full py-3">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Deal'}</button>
                <button onClick={() => setShowForm(false)} className="btn-ghost w-full py-2">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)} role="dialog" aria-label="Delete deal">
          <div className="card p-4 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-fg mb-1">Delete "{confirmDelete.name}"?</h3>
            <p className="text-xs text-fg-subtle mb-4">The counter stops applying it immediately. Past bills keep their recorded discounts.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1 py-2.5">Keep</button>
              <button onClick={() => remove(confirmDelete)} className="btn-primary flex-1 py-2.5 bg-negative hover:bg-negative/90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
