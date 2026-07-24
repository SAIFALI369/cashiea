// ════════════════════════════════════════════════════════════════
// Task History — stores the last 10 quick-task runs in localStorage.
// No network calls, no DB writes — purely client-side for instant
// "that report I generated this morning" recall.
// ════════════════════════════════════════════════════════════════

export interface HistoryEntry {
  mode: string
  label: string
  resultPreview: string  // first 120 chars for the list view
  fullResult: string
  meta: Record<string, unknown>
  timestamp: number
}

const KEY = 'cashiea_task_history'
// Storage key used before the product was renamed to Cashiea. Migrated once on read, then discarded.
const LEGACY_KEY = 'bizautomate_task_history'
const MAX = 10

export function getHistory(): HistoryEntry[] {
  try {
    // One-time migration: carry over history saved under the pre-rename key, then drop it.
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, legacy)
      localStorage.removeItem(LEGACY_KEY)
    }
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addToHistory(entry: Omit<HistoryEntry, 'timestamp'>): void {
  try {
    const history = getHistory()
    history.unshift({ ...entry, timestamp: Date.now() })
    // Keep only the most recent MAX entries
    if (history.length > MAX) history.length = MAX
    localStorage.setItem(KEY, JSON.stringify(history))
  } catch {
    // localStorage might be full or blocked — non-fatal
  }
}

export function clearHistory(): void {
  try { localStorage.removeItem(KEY) } catch { /* noop */ }
}

/**
 * Human-readable relative time — "just now", "5m ago", "2h ago", "Yesterday"
 */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  const hr = Math.floor(diff / 3600000)
  const day = Math.floor(diff / 86400000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  if (hr < 24) return `${hr}h ago`
  if (day === 1) return 'Yesterday'
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString()
}

/**
 * Get yesterday's date as YYYY-MM-DD (IST).
 */
export function yesterdayIST(): string {
  const now = new Date()
  const ist = new Date(now.getTime() - 5.5 * 3600 * 1000 - 86400000)
  return ist.toISOString().split('T')[0]
}
