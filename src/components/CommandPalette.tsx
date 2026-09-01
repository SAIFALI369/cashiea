import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, ShoppingCart, Package, Users, Receipt, BookOpen,
  FileBarChart, Sparkles, Landmark, FileSignature, TrendingUp, Wallet, CornerDownLeft,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * CommandPalette — Ctrl+K (and the desktop header's search button).
 * One flat, searchable list of everywhere worth going; Enter navigates,
 * arrow keys move, Esc closes. Listens for the app-wide
 * 'cashiea:command-palette' event dispatched by the keyboard-shortcuts
 * hook and the DesktopHeader search button.
 */
interface Command {
  label: string
  hint: string
  icon: LucideIcon
  to: string
  keywords: string
}

const COMMANDS: Command[] = [
  { label: 'Today — dashboard', hint: 'Sales, stock & dues at a glance', icon: LayoutDashboard, to: '/app', keywords: 'home dashboard today stats' },
  { label: 'New sale (POS)', hint: 'Ring up a sale at the counter', icon: ShoppingCart, to: '/app/pos', keywords: 'pos sale bill checkout counter' },
  { label: 'Stock — products', hint: 'Inventory, restock, CSV import', icon: Package, to: '/app/products', keywords: 'stock products inventory items restock' },
  { label: 'Customers', hint: 'CRM, history, follow-ups', icon: Users, to: '/app/customers', keywords: 'customers crm clients' },
  { label: 'Bills — invoices', hint: 'GST tax invoices, share, collect', icon: Receipt, to: '/app/invoices', keywords: 'invoices bills gst tax invoice' },
  { label: 'Khata — udhaar book', hint: 'Who owes what', icon: BookOpen, to: '/app/khata', keywords: 'khata udhaar credit dues ledger' },
  { label: 'Reports', hint: 'AI reports, PDF & Excel', icon: FileBarChart, to: '/app/reports', keywords: 'reports analysis excel pdf' },
  { label: 'Profit dashboard', hint: 'Revenue, COGS, net profit', icon: TrendingUp, to: '/app/profit-dashboard', keywords: 'profit revenue cogs margin' },
  { label: 'GST export', hint: 'GSTR-1 sheet for your CA', icon: FileSignature, to: '/app/gst-export', keywords: 'gst gstr1 export filing tax' },
  { label: 'Bank import', hint: 'Match statement to invoices', icon: Landmark, to: '/app/bank-import', keywords: 'bank statement import reconcile' },
  { label: 'Accounts — expenses', hint: 'Cash flow, income, entries', icon: Wallet, to: '/app/accounts', keywords: 'accounts expenses income cashflow' },
  { label: 'Quotations', hint: 'Price quotes', icon: FileSignature, to: '/app/quotations', keywords: 'quotes quotations estimate' },
  { label: 'Ask Meraj', hint: 'Full AI assistant', icon: Sparkles, to: '/app/assistant', keywords: 'meraj ai assistant ask chat voice' },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onOpen = () => { setOpen(true); setQuery(''); setSelected(0) }
    window.addEventListener('cashiea:command-palette', onOpen)
    return () => window.removeEventListener('cashiea:command-palette', onOpen)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter((c) =>
      c.label.toLowerCase().includes(q) || c.keywords.includes(q) || c.hint.toLowerCase().includes(q))
  }, [query])

  useEffect(() => { setSelected(0) }, [query])
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  if (!open) return null

  const go = (c: Command | undefined) => {
    if (!c) return
    setOpen(false)
    navigate(c.to)
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-label="Command palette"
    >
      <div
        className="card w-full max-w-lg overflow-hidden shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line">
          <Search className="w-4 h-4 text-fg-subtle flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false)
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)) }
              if (e.key === 'Enter') go(filtered[selected])
            }}
            className="flex-1 bg-transparent outline-none text-sm text-fg placeholder:text-fg-subtle"
            placeholder="Go to… (stock, bills, khata, Meraj)"
            aria-label="Search commands"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 border border-line text-fg-subtle">esc</kbd>
        </div>
        <div className="max-h-[46vh] overflow-y-auto scroll-area py-1.5">
          {filtered.length === 0 && (
            <p className="text-sm text-fg-subtle text-center py-8">Nothing matches “{query}”</p>
          )}
          {filtered.map((c, i) => (
            <button
              key={c.to + c.label}
              onClick={() => go(c)}
              onMouseEnter={() => setSelected(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${i === selected ? 'bg-accent-soft/60' : 'hover:bg-surface-2/60'}`}
            >
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${i === selected ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-fg-muted'}`}>
                <c.icon className="w-4 h-4" strokeWidth={1.75} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-fg truncate">{c.label}</span>
                <span className="block text-xs text-fg-subtle truncate">{c.hint}</span>
              </span>
              {i === selected && <CornerDownLeft className="w-3.5 h-3.5 text-fg-subtle flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
