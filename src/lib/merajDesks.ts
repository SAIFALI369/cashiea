// ════════════════════════════════════════════════════════════════
// Meraj desks — every automation the owner can ask for or run
// from Ask / Execute. One catalog drives:
//   • the Execute grid on the Meraj page
//   • confirm-button labels
//   • tests that the assistant still knows the desks
// The edge function mirrors the ids in TASK_SYSTEM (Deno cannot
// import this file). Keep the `id` values identical.
// ════════════════════════════════════════════════════════════════

export interface MerajDesk {
  id: string
  label: string
  desc: string
  href: string
  /** What Meraj hears when the owner taps the Execute card. */
  prompt: string
  /** Lucide icon name resolved by the Meraj page. */
  icon: string
  /** Owner-only write (draft PO, apply price). Inspect desks are open to staff. */
  write?: boolean
}

export const MERAJ_DESKS: MerajDesk[] = [
  {
    id: 'auto-reorder',
    label: 'Auto-reorder',
    desc: 'Size a draft PO from 30-day sales',
    href: '/app/auto-reorder',
    prompt: 'Review stock that is running out. Summarise what to reorder from the last 30 days of sales, then open Auto-reorder so I can draft the purchase order.',
    icon: 'RefreshCw',
    write: true,
  },
  {
    id: 'pricing',
    label: 'Price suggestions',
    desc: 'Raise or markdown — never below cost',
    href: '/app/pricing',
    prompt: 'Suggest selling-price moves from the last 30 days of sales. A cut must never go below cost. Then open Price suggestions so I can Apply.',
    icon: 'Tag',
    write: true,
  },
  {
    id: 'cash-flow',
    label: 'Cash flow',
    desc: '30 / 60 / 90-day picture',
    href: '/app/cash-flow',
    prompt: 'What is my 30, 60 and 90-day cash picture — unpaid invoices versus supplier dues and typical expenses? Then open Cash flow.',
    icon: 'Wallet',
  },
  {
    id: 'reminders',
    label: 'Reminders',
    desc: 'GST, dues, festivals, follow-ups',
    href: '/app/reminders',
    prompt: 'What should I handle today — overdue bills, GST dates, festivals, dormant customers or low stock? Then open Reminders.',
    icon: 'Bell',
  },
  {
    id: 'duplicates',
    label: 'Data hygiene',
    desc: 'Duplicates, repeat bills, stale stock',
    href: '/app/duplicates',
    prompt: 'Scan for duplicate customers or products, same-day repeat bills, and stock that has not sold in 90 days. Then open Data hygiene.',
    icon: 'Copy',
  },
  {
    id: 'snapshot',
    label: 'Snapshot',
    desc: 'Shareable card of today / week / month',
    href: '/app/snapshot',
    prompt: 'Give me today’s business snapshot — sales, bills, profit and the top item — then open the Snapshot card so I can share it.',
    icon: 'Camera',
  },
  {
    id: 'goals',
    label: 'Goals',
    desc: 'Streak, weekly grade, local targets',
    href: '/app/goals',
    prompt: 'How is my billing streak and this week versus last week? Then open Goals.',
    icon: 'Target',
  },
  {
    id: 'scorecard',
    label: 'Supplier scorecard',
    desc: 'Grades from POs and dues — no invented on-time %',
    href: '/app/scorecard',
    prompt: 'Grade my suppliers from purchase-order volume, outstanding dues and open POs past the expected date. Do not invent an on-time percent. Then open the Supplier scorecard.',
    icon: 'Truck',
  },
  {
    id: 'social',
    label: 'Social drafts',
    desc: 'Status captions — never auto-posted',
    href: '/app/social',
    prompt: 'Draft WhatsApp Status captions from today’s bills. Never mention profit and never post — just draft. Then open Social drafts.',
    icon: 'Share2',
  },
  {
    id: 'gst-export',
    label: 'GST working',
    desc: 'Health flags + JSON / Excel, not a filing',
    href: '/app/gst-export',
    prompt: 'How healthy is this month’s GST working sheet — mismatches, missing GSTIN, rate issues? Then open GST Export. This is not a GSTN filing.',
    icon: 'FileSpreadsheet',
  },
  {
    id: 'bank-import',
    label: 'Bank match',
    desc: 'Match credits to unpaid invoices',
    href: '/app/bank-import',
    prompt: 'I want to match a bank statement to unpaid invoices. Open Bank Import and tell me how matching works.',
    icon: 'Landmark',
  },
  {
    id: 'invoices',
    label: 'Create invoice',
    desc: 'GST bill — review, then save',
    href: '/app/invoices',
    prompt: 'I want to create a GST invoice. Ask me for the customer and items, look up catalogue prices and GST when you can, and never guess a price.',
    icon: 'FileText',
    write: true,
  },
  {
    id: 'reports',
    label: 'Daily report',
    desc: 'Briefing from live Cashiea numbers',
    href: '/app/reports',
    prompt: 'Draft a short daily business briefing from live numbers — sales, dues, stock that needs attention — then open Reports if I want the full PDF.',
    icon: 'BarChart3',
  },
  {
    id: 'customers',
    label: 'Customer 360',
    desc: 'Who to follow up, who spends',
    href: '/app/customers',
    prompt: 'Who are my top customers and who has gone quiet? Suggest one follow-up, then open Customers.',
    icon: 'Users',
  },
]

export const MERAJ_DESK_IDS = MERAJ_DESKS.map((d) => d.id)

export function getMerajDesk(id: string): MerajDesk | undefined {
  return MERAJ_DESKS.find((d) => d.id === id)
}

/** Compact catalog injected into tests / client prompts. */
export function merajDeskCatalogText(): string {
  return MERAJ_DESKS.map((d) => `- ${d.label} (${d.href}): ${d.desc}`).join('\n')
}

export function merajConfirmLabel(type: string | undefined): string {
  switch (type) {
    case 'create_invoice': return 'Create it'
    case 'send_whatsapp': return 'Send it'
    case 'sync_stock_from_sheet': return 'Sync it'
    case 'export_to_sheet': return 'Export it'
    case 'open_desk': return 'Open it'
    case 'draft_purchase_order': return 'Draft the PO'
    case 'apply_price_changes': return 'Apply prices'
    case 'add_product':
    case 'add_products':
    case 'add_customer':
      return 'Add it'
    default:
      return 'Confirm'
  }
}
