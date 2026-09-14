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
import { Loader2, Plus, Tag, Trash2, Power, CalendarClock, X } from 'lucide-react'
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
      const target = cfg.productId
        ? products.find((p) => p.id === cfg.productId)?.name || 'a product'
        : cfg.category || 'a category'
      return `Buy ${cfg.buy} get ${cfg.get} at ${cfg.discountPct}% off · ${target}`
    }
    if (r.kind === 'tiered') {
      const tiers = (r.config as Partial<TieredConfig>)?.tiers || []
      return tiers.map((t) => `${formatINR(t.minSpend, 0)}+ → ${t.pct}%`).join(' · ')
    }
    const cfg = r.config as Partial<PercentConfig>
    return `${cfg.pct}% off${cfg.maxDiscount ? ` (max ${formatINR(cfg.maxDiscount, 0)})` : ''}`
  }

  const activeCount = useMemo(() => rules.filter((r) => r.enabled).length, [rules])

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
  }

  return (
    <div className="animate-fade-in">
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
          <div className="space-y-2.5">
            {rules.map((r) => (
              <div key={r.id} className={`card p-4 ${r.enabled ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-fg">{r.name}</p>
                    <p className="text-xs text-fg-muted mt-0.5">{configText(r)}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle mt-1.5">
                      <CalendarClock className="w-3 h-3" /> {windowText(r)}
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${r.enabled ? 'bg-positive/15 text-positive' : 'bg-surface-2 text-fg-subtle'}`}>
                        {r.enabled ? 'ACTIVE' : 'PAUSED'}
                      </span>
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggle(r)} className={`icon-btn ${r.enabled ? 'text-positive' : 'text-fg-subtle'}`} title={r.enabled ? 'Pause deal' : 'Activate deal'} aria-label={r.enabled ? 'Pause deal' : 'Activate deal'}>
                        <Power className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDelete(r)} className="icon-btn text-negative hover:text-negative" title="Delete deal" aria-label="Delete deal">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* New deal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setShowForm(false)} role="dialog" aria-label="New deal">
          <div className="card p-4 w-full sm:max-w-md rounded-b-none sm:rounded-card max-h-[92vh] overflow-y-auto scroll-area" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-fg">New deal</h3>
              <button onClick={() => setShowForm(false)} className="icon-btn" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>

            <div className="space-y-3">
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
                    <select value={draft.productId} onChange={(e) => set({ productId: e.target.value, category: '' })} className="input-field mb-2">
                      <option value="">— a category (below) —</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {!draft.productId && (
                      <input value={draft.category} onChange={(e) => set({ category: e.target.value })} className="input-field" placeholder="Category name (e.g. snacks)" />
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="label">Buy</label>
                      <input type="number" min={1} value={draft.buy} onChange={(e) => set({ buy: e.target.value })} className="input-field tabular-nums" />
                    </div>
                    <div>
                      <label className="label">Get</label>
                      <input type="number" min={1} value={draft.get} onChange={(e) => set({ get: e.target.value })} className="input-field tabular-nums" />
                    </div>
                    <div>
                      <label className="label">% off on free</label>
                      <input type="number" min={1} max={100} value={draft.discountPct} onChange={(e) => set({ discountPct: e.target.value })} className="input-field tabular-nums" />
                    </div>
                  </div>
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

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="btn-ghost flex-1 py-3">Cancel</button>
                <button onClick={save} disabled={saving} className="btn-primary flex-1 py-3">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create deal'}
                </button>
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
