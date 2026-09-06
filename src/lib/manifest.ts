// ════════════════════════════════════════════════════════════════
// Meraj's Morning Manifest — the one-tap action queue.
//
// The strategy: an owner should OPEN THE APP and see what their
// manager (Meraj) has lined up for today — approvals waiting,
// money to collect, stock to reorder — each with ONE tap to act.
// The owner decides; Meraj has already done the thinking.
// ════════════════════════════════════════════════════════════════

export type ManifestKind = 'approval' | 'overdue' | 'lowstock'

export interface ManifestItem {
  id: string
  kind: ManifestKind
  title: string
  detail: string
  /** Rupees at stake, when the item is about money. */
  money?: number
  /** Higher = do first. */
  priority: number
  cta: {
    label: string
    /** 'approve'/'deny' execute inline; 'link' navigates; 'ask' opens Meraj. */
    kind: 'approve' | 'deny' | 'link' | 'ask'
    to?: string
    query?: string
  }
}

interface ManifestInput {
  approvals: { id: string; summary?: string | null; requester_name?: string | null }[]
  overdue: { id: string; invoice_number?: string | null; client_name?: string | null; total?: number | null }[]
  lowStock: { id: string; name: string; stock_quantity?: number | null; low_stock_threshold?: number | null }[]
}

export const KIND_META: Record<ManifestKind, { label: string; tone: string }> = {
  approval: { label: 'Needs your OK', tone: 'bg-secondary-soft text-secondary-strong' },
  overdue: { label: 'Money to collect', tone: 'bg-warning/10 text-warning' },
  lowstock: { label: 'Reorder', tone: 'bg-negative/10 text-negative' },
}

/**
 * Assemble and rank the day's plan. Team approvals come first (a person
 * is blocked waiting), then money to collect, then stock. Within money,
 * bigger amounts first — the owner's attention is the scarcest resource.
 */
export function buildManifest(input: ManifestInput): ManifestItem[] {
  const items: ManifestItem[] = []

  for (const cr of input.approvals) {
    items.push({
      id: `cr-${cr.id}`,
      kind: 'approval',
      title: cr.summary || 'A team action needs your approval',
      detail: `${cr.requester_name || 'A team member'} sent this — tap OK and Meraj executes it.`,
      priority: 100,
      cta: { label: 'Approve', kind: 'approve' },
    })
  }

  const overdue = [...input.overdue].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0))
  for (const inv of overdue) {
    items.push({
      id: `inv-${inv.id}`,
      kind: 'overdue',
      title: `${inv.client_name || 'Customer'} — ₹${Number(inv.total || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} overdue`,
      detail: `Invoice ${inv.invoice_number || ''} is past its due date. Meraj can draft the reminder — you just send it.`,
      money: Number(inv.total) || 0,
      priority: 80,
      cta: {
        label: 'Remind',
        kind: 'ask',
        query: `Draft a short, polite WhatsApp payment reminder for ${inv.client_name || 'my customer'} — invoice ${inv.invoice_number || ''}, ₹${Number(inv.total || 0).toLocaleString('en-IN')}, overdue. Ready to send.`,
      },
    })
  }

  const low = [...input.lowStock].sort((a, b) => (Number(a.stock_quantity) || 0) - (Number(b.stock_quantity) || 0))
  for (const p of low) {
    items.push({
      id: `prd-${p.id}`,
      kind: 'lowstock',
      title: `${p.name} — ${Number(p.stock_quantity) || 0} left`,
      detail: `At or below your alert level (${Number(p.low_stock_threshold) || 0}). Meraj has sized a draft PO.`,
      priority: 60,
      cta: { label: 'Reorder', kind: 'link', to: '/app/auto-reorder' },
    })
  }

  // Ids must be unique across kinds (they are prefixed) — dedupe defensively.
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
}

/** One summary line for the header: how much is on the line today. */
export function manifestSummary(items: ManifestItem[]): { count: number; money: number } {
  return {
    count: items.length,
    money: items.reduce((s, i) => s + (i.money || 0), 0),
  }
}
