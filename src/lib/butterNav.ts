import type { LucideIcon } from 'lucide-react'
import { LayoutDashboard, ShoppingCart, Users, Sparkles } from 'lucide-react'

// ════════════════════════════════════════════════════════════════
// BUTTER NAV — the page-flow model behind the gesture system.
//
// Two ideas, both borrowed from the best native apps:
//
// 1. DIRECTION — every navigation has a *kind*:
//      lateral : swapping between the primary tabs (Today · New Sale
//                · Customers · Meraj) — sibling pages slide in the
//                same direction, tab-style.
//      push    : going deeper into a section (e.g. Campaigns → New
//                campaign) — the new page slides in over the shell.
//      pop     : going back up — the page settles forward from
//                underneath, like a stack being popped.
//      fade    : unrelated cross-section jump — calm crossfade.
//      instant : a gesture already played the hand-over under the
//                finger, so the page mounts at rest (no replay).
//
// 2. GESTURES — the model also answers "what may the left screen edge
//    do here?" Primary tabs reserve it for the sidebar drawer; deeper
//    pages reserve it for the iOS-style swipe-back.
//
// NOTE ON SNAPSHOTS: an earlier revision froze a page's `innerHTML` on
// leave and re-injected it into the drag peek layer. That copy lost its
// React bindings and kept mid-flight inline transforms, so charts,
// inputs and sticky bars painted scrambled — and the page's words
// existed twice in the DOM at once. The peek layer is now a branded
// preview built from this module's page metadata, so nothing is ever
// duplicated. See PageStack.tsx.
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
  if (next < 0 || next >= PRIMARY_PAGES.length) return null
  return PRIMARY_PAGES[next]
}

/** True when the page sits deeper than the primary tabs, i.e. when the
 *  left screen edge should mean "swipe back" instead of "open drawer". */
export function canSwipeBack(path: string): boolean {
  return pageDepth(path) > 0
}

/** Where "back" goes when there is no history to pop (deep link). */
export function fallbackBackTarget(path: string): string {
  return pageDepth(path) === 2 ? '/app/campaigns' : '/app'
}
