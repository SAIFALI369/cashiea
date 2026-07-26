import { Link } from 'react-router-dom'
import { Search, ChevronRight, FileBarChart, AlertTriangle, Receipt } from 'lucide-react'

const QUICK: { label: string; to: string; icon: typeof Search }[] = [
  { label: 'Daily closing', to: '/app/assistant?scope=reports', icon: FileBarChart },
  { label: 'Low stock', to: '/app/assistant?scope=stocks', icon: AlertTriangle },
  { label: 'GST invoice', to: '/app/assistant?scope=receipts', icon: Receipt },
]

/** Docked "Do Anything" bar — tapping it opens the full-screen Meraj page. */
export default function DoAnythingBar() {
  return (
    <div>
      <Link
        to="/app/assistant"
        className="card card-hover flex items-center gap-3 p-2 pl-4 shadow-soft group"
      >
        <Search className="w-5 h-5 text-fg-subtle group-hover:text-accent transition-colors" strokeWidth={1.75} />
        <span className="flex-1 text-sm text-fg-subtle">Do anything — ask Meraj…</span>
        <span className="btn-primary px-3 h-9 text-sm pointer-events-none">Open</span>
      </Link>

      <div className="flex flex-wrap gap-2 mt-3">
        {QUICK.map((t) => (
          <Link
            key={t.label}
            to={t.to}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-line bg-surface text-fg-muted hover:text-fg hover:border-line-2 transition-all"
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
