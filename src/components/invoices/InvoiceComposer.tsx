import { useMemo, useState } from 'react'
import { Check, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { GST_SLABS, gstinState } from '../../lib/india-compliance'
import { quoteTotals, type LineInput } from '../../lib/quoteMath'
import { formatINR } from '../../lib/format'
import { validateGstin } from '../../lib/validation'
import type { Customer, Product } from '../../lib/types'

export interface ComposerLine {
  description: string
  quantity: string
  unit_price: string
  gst_rate: string
  hsn_code: string
}

export interface InvoiceDraft {
  client_name: string
  client_phone: string
  client_email: string
  client_address: string
  client_gstin: string
  due_date: string
  notes: string
  discount_pct: string
  is_interstate: boolean
  items: ComposerLine[]
}

const emptyLine = (): ComposerLine => ({
  description: '', quantity: '1', unit_price: '', gst_rate: '0', hsn_code: '',
})

function plusDays(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function emptyInvoiceDraft(): InvoiceDraft {
  return {
    client_name: '',
    client_phone: '',
    client_email: '',
    client_address: '',
    client_gstin: '',
    due_date: plusDays(7),
    notes: '',
    discount_pct: '',
    is_interstate: false,
    items: [emptyLine()],
  }
}

/** Hydrate the composer from a parsed AI invoice (review before save). */
export function draftFromParsed(parsed: {
  client_name?: string
  client_phone?: string
  client_email?: string
  client_address?: string
  client_gstin?: string
  due_date?: string
  notes?: string
  tax_rate?: number
  items?: { description?: string; name?: string; quantity?: number; qty?: number; unit_price?: number; gst_rate?: number; hsn_code?: string }[]
}): InvoiceDraft {
  const base = emptyInvoiceDraft()
  const items = (parsed.items || []).map((it) => ({
    description: String(it.description || it.name || '').trim(),
    quantity: String(it.quantity ?? it.qty ?? 1),
    unit_price: String(it.unit_price ?? ''),
    gst_rate: String(it.gst_rate ?? parsed.tax_rate ?? 0),
    hsn_code: String(it.hsn_code || ''),
  })).filter((it) => it.description)
  return {
    ...base,
    client_name: parsed.client_name || '',
    client_phone: parsed.client_phone || '',
    client_email: parsed.client_email || '',
    client_address: parsed.client_address || '',
    client_gstin: (parsed.client_gstin || '').toUpperCase(),
    due_date: parsed.due_date || base.due_date,
    notes: parsed.notes || '',
    items: items.length ? items : [emptyLine()],
  }
}

export interface InvoiceComposerProps {
  draft: InvoiceDraft
  onChange: (next: InvoiceDraft) => void
  onSave: (as: 'draft' | 'sent') => void
  onCancel: () => void
  saving: boolean
  customers: Pick<Customer, 'id' | 'name' | 'phone' | 'email' | 'address'>[]
  products: Pick<Product, 'id' | 'name' | 'price' | 'hsn_code' | 'gst_rate'>[]
  /** Shop GSTIN — used to auto-flag interstate when the buyer GSTIN is in another state. */
  shopGstin?: string | null
  shopState?: string | null
  source?: 'ai' | 'manual'
}

export function InvoiceComposer({
  draft, onChange, onSave, onCancel, saving, customers, products, shopGstin, shopState, source,
}: InvoiceComposerProps) {
  const [suggestFor, setSuggestFor] = useState<number | null>(null)
  const set = (patch: Partial<InvoiceDraft>) => onChange({ ...draft, ...patch })

  const pickCustomer = (id: string) => {
    const c = customers.find((x) => x.id === id)
    if (!c) return
    set({
      client_name: c.name || draft.client_name,
      client_phone: c.phone || draft.client_phone,
      client_email: c.email || draft.client_email,
      client_address: c.address || draft.client_address,
    })
  }

  const updateLine = (i: number, patch: Partial<ComposerLine>) => {
    const items = draft.items.map((row, idx) => idx === i ? { ...row, ...patch } : row)
    onChange({ ...draft, items })
  }

  const pickProduct = (i: number, p: Pick<Product, 'name' | 'price' | 'hsn_code' | 'gst_rate'>) => {
    updateLine(i, {
      description: p.name,
      unit_price: String(p.price ?? ''),
      hsn_code: p.hsn_code || draft.items[i].hsn_code,
      gst_rate: p.gst_rate != null ? String(p.gst_rate) : draft.items[i].gst_rate,
    })
    setSuggestFor(null)
  }

  const buyerState = gstinState(draft.client_gstin)
  const sellerState = gstinState(shopGstin || '') || shopState || ''
  const autoInterstate = !!(buyerState && sellerState && buyerState !== sellerState)
  const interstate = autoInterstate || draft.is_interstate

  const lineInputs: LineInput[] = draft.items.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unit_price: it.unit_price,
    gst_rate: it.gst_rate,
    hsn_code: it.hsn_code,
  }))
  const doc = useMemo(
    () => quoteTotals(lineInputs, 0, { discountPct: draft.discount_pct, isInterstate: interstate }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(lineInputs), draft.discount_pct, interstate],
  )

  const gstinCheck = draft.client_gstin.trim() ? validateGstin(draft.client_gstin) : { valid: true }
  const canSave = draft.client_name.trim() && doc.lines.length > 0 && gstinCheck.valid && !saving

  return (
    <div className="card p-4 mb-6 animate-slide-up">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-fg flex items-center gap-2">
            {source === 'ai' ? <Sparkles className="w-4 h-4 text-accent" /> : null}
            {source === 'ai' ? 'Review the bill Meraj drafted' : 'New invoice'}
          </h3>
          <p className="text-xs text-fg-muted mt-0.5">
            Catalogue prices and GST fill in when you pick a product. Nothing is saved until you confirm.
          </p>
        </div>
        <button onClick={onCancel} className="w-11 h-11 -mr-2 -mt-2 rounded-xl flex items-center justify-center text-fg-subtle hover:text-fg" aria-label="Close composer">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {customers.length > 0 && (
          <label className="block sm:col-span-2">
            <span className="label">Customer on file</span>
            <select className="input-field" defaultValue="" onChange={(e) => pickCustomer(e.target.value)} aria-label="Pick a customer">
              <option value="">Walk-in / type the name below</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
            </select>
          </label>
        )}
        <label className="block sm:col-span-2">
          <span className="label">Bill to *</span>
          <input value={draft.client_name} onChange={(e) => set({ client_name: e.target.value })} className="input-field" placeholder="Customer name" />
        </label>
        <input value={draft.client_phone} onChange={(e) => set({ client_phone: e.target.value })} className="input-field" placeholder="Phone (WhatsApp)" inputMode="tel" aria-label="Phone" />
        <input value={draft.client_email} onChange={(e) => set({ client_email: e.target.value })} className="input-field" placeholder="Email (optional)" inputMode="email" aria-label="Email" />
        <input
          value={draft.client_gstin}
          onChange={(e) => set({ client_gstin: e.target.value.toUpperCase() })}
          className="input-field font-mono uppercase"
          placeholder="Buyer GSTIN (B2B)"
          aria-label="Buyer GSTIN"
        />
        <input type="date" value={draft.due_date} onChange={(e) => set({ due_date: e.target.value })} className="input-field" aria-label="Due date" />
        <input value={draft.client_address} onChange={(e) => set({ client_address: e.target.value })} className="input-field sm:col-span-2" placeholder="Address (optional)" aria-label="Address" />
        {!gstinCheck.valid && (
          <p className="sm:col-span-2 text-xs text-negative">{gstinCheck.message || 'Enter a valid 15-character GSTIN'}</p>
        )}
        {buyerState && (
          <p className="sm:col-span-2 text-[11px] text-fg-subtle">
            Place of supply: {buyerState}{autoInterstate ? ' · billed as IGST (inter-state)' : ' · billed as CGST + SGST'}
          </p>
        )}
      </div>

      <p className="label mb-2">Line items</p>
      <div className="space-y-2 mb-3">
        {draft.items.map((it, i) => {
          const q = it.description.trim().toLowerCase()
          const matches = q.length >= 2
            ? products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6)
            : []
          return (
            <div key={i} className="rounded-xl border border-line bg-surface/50 p-2.5">
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <input
                    value={it.description}
                    onChange={(e) => { updateLine(i, { description: e.target.value }); setSuggestFor(i) }}
                    onFocus={() => setSuggestFor(i)}
                    className="input-field"
                    placeholder="Item or service"
                    aria-label={`Item ${i + 1} description`}
                  />
                  {suggestFor === i && matches.length > 0 && (
                    <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl border border-line bg-surface shadow-float overflow-hidden">
                      {matches.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pickProduct(i, p)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 flex items-center justify-between gap-2"
                        >
                          <span className="truncate text-fg">{p.name}</span>
                          <span className="text-xs text-fg-subtle tabular-nums flex-shrink-0">{formatINR(Number(p.price) || 0, 0)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {draft.items.length > 1 && (
                  <button onClick={() => onChange({ ...draft, items: draft.items.filter((_, idx) => idx !== i) })} className="w-11 h-11 rounded-xl flex items-center justify-center text-fg-subtle hover:text-negative flex-shrink-0" aria-label="Remove line">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                <input type="number" min={0} value={it.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} className="input-field" placeholder="Qty" aria-label="Quantity" />
                <input type="number" min={0} step="0.01" value={it.unit_price} onChange={(e) => updateLine(i, { unit_price: e.target.value })} className="input-field" placeholder="Rate ₹" aria-label="Unit price" />
                <select value={it.gst_rate} onChange={(e) => updateLine(i, { gst_rate: e.target.value })} className="input-field" aria-label="GST rate">
                  {GST_SLABS.map((r) => <option key={r} value={String(r)}>{r}% GST</option>)}
                </select>
                <input value={it.hsn_code} onChange={(e) => updateLine(i, { hsn_code: e.target.value })} className="input-field font-mono" placeholder="HSN" aria-label="HSN code" />
              </div>
            </div>
          )
        })}
      </div>
      <button onClick={() => onChange({ ...draft, items: [...draft.items, emptyLine()] })} className="btn-ghost text-xs mb-4">
        <Plus className="w-3.5 h-3.5" /> Add a line
      </button>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="label">Discount %</span>
          <input type="number" min={0} max={100} value={draft.discount_pct} onChange={(e) => set({ discount_pct: e.target.value })} className="input-field" placeholder="0" />
        </label>
        <label className="flex items-center gap-2 mt-6 text-sm text-fg">
          <input
            type="checkbox"
            checked={interstate}
            onChange={(e) => set({ is_interstate: e.target.checked })}
            className="w-4 h-4 accent-[rgb(var(--accent-strong))]"
          />
          Inter-state supply (IGST)
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Note on the bill</span>
          <textarea
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
            rows={2}
            className="input-field resize-none"
            placeholder="Optional — a short courtesy line is added if you leave this blank."
          />
        </label>
      </div>

      <div className="rounded-xl border border-line bg-surface/60 p-3 mb-4 text-sm space-y-1">
        <div className="flex justify-between text-fg-muted"><span>Goods / services</span><span className="tabular-nums">{formatINR(doc.line)}</span></div>
        {doc.discountAmount > 0 && (
          <div className="flex justify-between text-fg-muted"><span>Discount ({doc.discountPct}%)</span><span className="tabular-nums">− {formatINR(doc.discountAmount)}</span></div>
        )}
        {doc.taxAmount > 0 && interstate && (
          <div className="flex justify-between text-fg-muted"><span>IGST</span><span className="tabular-nums">{formatINR(doc.taxAmount)}</span></div>
        )}
        {doc.taxAmount > 0 && !interstate && (
          <>
            <div className="flex justify-between text-fg-muted"><span>CGST</span><span className="tabular-nums">{formatINR(doc.taxAmount / 2)}</span></div>
            <div className="flex justify-between text-fg-muted"><span>SGST</span><span className="tabular-nums">{formatINR(doc.taxAmount / 2)}</span></div>
          </>
        )}
        <div className="flex justify-between text-lg font-bold text-fg pt-1 border-t border-line"><span>Total</span><span className="tabular-nums">{formatINR(doc.total)}</span></div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
        <button onClick={() => onSave('draft')} disabled={!canSave} className="btn-secondary text-sm disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save as draft
        </button>
        <button onClick={() => onSave('sent')} disabled={!canSave} className="btn-primary text-sm disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Create & share
        </button>
      </div>
    </div>
  )
}
