import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ShoppingCart, Users, Sparkles } from 'lucide-react'

// ════════════════════════════════════════════════════════════════
// BUTTER NAV — the page-flow model behind the swipe system.
//
// Two ideas, both borrowed from the best native apps:
//
// 1. DIRECTION — every navigation has a *kind*:
//      lateral : swapping between the primary tabs (Today · New Sale
//                · Customers · Meraj) — sibling pages slide in the
//                same direction, tab-style.
//      push    : going deeper into a section (e.g. Campaigns → New
//                campaign) — the new page slides over the old one.
//      pop     : going back up — the old page slides away and
//                reveals the page beneath.
//      fade    : unrelated cross-section jump — calm crossfade.
//
// 2. SNAPSHOTS — when you leave a page we freeze a lightweight DOM
//    snapshot of it. When you drag horizontally on a primary tab the
//    REAL neighbour page (last seen) is revealed under your finger,
//    1:1 lockstep — exactly like a native ViewPager — without
//    double-fetching any data.
// ════════════════════════════════════════════════════════════════

export interface PrimaryPage {
  path: string
  label: string
  icon: LucideIcon
}

/** The lateral swipe ring, in bottom-nav order. */
export const PRIMARY_PAGES: PrimaryPage[] = [
  { path: '/app', label: 'Today', icon: LayoutDashboard },
  { path: '/app/pos', label: 'New Sale', icon: ShoppingCart },
  { path: '/app/customers', label: 'Customers', icon: Users },
  { path: '/app/assistant', label: 'Meraj', icon: Sparkles },
]

export const PRIMARY_PATHS = PRIMARY_PAGES.map((p) => p.path)

export type NavKind = 'push' | 'pop' | 'lateral' | 'fade' | 'instant'

export interface NavDirection {
  kind: NavKind
  /** +1 forward/right, −1 back/left */
  sign: 1 | -1 | 0
}

/** Hierarchical depth: primary tabs sit at 0, section pages at 1,
 *  editor/detail pages at 2. Used to choose push vs pop. */
export function pageDepth(path: string): number {
  if (PRIMARY_PATHS.includes(path)) return 0
  if (path === '/app/campaigns/new') return 2
  if (/^\/app\/campaigns\/[^/]+$/.test(path)) return 2
  if (path.startsWith('/app/') && path !== '/app') return 1
  return 0
}

/** What kind of transition takes `from` → `to`. */
export function navDirection(from: string, to: string): NavDirection {
  if (from === to) return { kind: 'fade', sign: 0 }
  const fi = PRIMARY_PATHS.indexOf(from)
  const ti = PRIMARY_PATHS.indexOf(to)
  if (fi !== -1 && ti !== -1) {
    return { kind: 'lateral', sign: ti > fi ? 1 : -1 }
  }
  const fd = pageDepth(from)
  const td = pageDepth(to)
  if (td > fd) return { kind: 'push', sign: 1 }
  if (td < fd) return { kind: 'pop', sign: -1 }
  return { kind: 'fade', sign: 0 }
}

/** Given the current page and a horizontal drag delta, which primary
 *  neighbour (if any) sits in that direction? dx < 0 → next tab. */
export function lateralNeighbor(path: string, dx: number): PrimaryPage | null {
  const i = PRIMARY_PATHS.indexOf(path)
  if (i === -1 || dx === 0) return null
  const next = dx < 0 ? i + 1 : i - 1
  if (next < 0 || next >= PRIMARY_PATHS.length) return null
  return PRIMARY_PAGES[next]
}

// ── Snapshot store ───────────────────────────────────────────────
// A tiny LRU of frozen page HTML. Snapshots are inert (never bound to
// handlers) and only ever rendered inside the pointer-events-none
// peek layer while a drag is in flight.

interface Snapshot {
  html: string
  at: number
}

const snapshots = new Map<string, Snapshot>()
const MAX_SNAPSHOTS = 6
const MAX_HTML_BYTES = 400_000

export function saveSnapshot(path: string, html: string): void {
  if (!path || !html || html.length > MAX_HTML_BYTES) return
  snapshots.delete(path)
  snapshots.set(path, { html, at: Date.now() })
  if (snapshots.size > MAX_SNAPSHOTS) {
    let oldestKey: string | null = null
    let oldestAt = Infinity
    for (const [k, v] of snapshots) {
      if (v.at < oldestAt) {
        oldestAt = v.at
        oldestKey = k
      }
    }
    if (oldestKey) snapshots.delete(oldestKey)
  }
}

export function getSnapshot(path: string): string | null {
  return snapshots.get(path)?.html ?? null
}
