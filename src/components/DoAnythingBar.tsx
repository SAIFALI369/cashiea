import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'

/** Premium search/action bar — tapping opens the full Meraj page. No separate button. */
export default function DoAnythingBar() {
  return (
    <Link to="/app/assistant" className="card card-hover flex items-center gap-3 p-3 pl-4 shadow-soft group">
      <Search className="w-5 h-5 text-fg-subtle group-hover:text-accent transition-colors" strokeWidth={1.75} />
      <span className="flex-1 text-sm text-fg-subtle">Do anything — ask Meraj…</span>
    </Link>
  )
}
