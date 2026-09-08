// ════════════════════════════════════════════════════════════════
// GESTURES — every rule that decides what a touch means, in one
// testable place. PageStack (page gestures), useEdgeDrawer (drawer) and
// the Sidebar (drag-to-dismiss) all read from here, so a threshold can
// never drift between two implementations of "the same" swipe.
// ════════════════════════════════════════════════════════════════

/** Left screen edge reserved for the drawer / swipe-back gesture. */
export const EDGE_SWIPE_ZONE = 36

/** Horizontal travel before a drag is unambiguous. */
export const DRAG_SLOP = 12

/** Vertical travel that hands the gesture back to native scrolling. */
export const VERTICAL_ESCAPE = 10

/** Release past this fraction of the screen width to commit. */
export const COMMIT_RATIO = 0.3

/** …or fling faster than this (px/s) in the right direction. */
export const COMMIT_VELOCITY = 520

/** Drag-to-dismiss thresholds for the sidebar drawer. */
export const DRAWER_DISMISS_DISTANCE = 80
export const DRAWER_DISMISS_VELOCITY = 700

export type DragIntent = 'lateral' | 'back' | 'rubber' | 'none'

// ── Guard rails ────────────────────────────────────────────────────
// A gesture must never start on something that already owns the touch.

function inScrollableRow(el: Element | null): boolean {
  let node = el
  while (node && node instanceof HTMLElement && node !== document.body) {
    const style = getComputedStyle(node)
    const scrollsX = (style.overflowX === 'auto' || style.overflowX === 'scroll')
    if (scrollsX && node.scrollWidth > node.clientWidth + 4) return true
    node = node.parentElement
  }
  return false
}

/** True when the touch belongs to someone else (dialog, input, chip row…). */
export function shouldIgnore(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target : null
  if (!el) return true
  if (el.closest('[data-no-swipe-nav]')) return true
  if (el.closest('[role="dialog"]')) return true
  if (el.closest('.fixed.inset-0')) return true
  if (el.closest('aside')) return true
  if (el.closest('nav[aria-label="Primary"]')) return true
  if (el.closest('input, textarea, select, [contenteditable="true"]')) return true
  if (inScrollableRow(el)) return true
  return false
}

// ── Intent ─────────────────────────────────────────────────────────

/**
 * What does this touch mean so far?
 *
 *   lateral : dragging between primary tabs (neighbour exists)
 *   rubber  : dragging past the end of the tab ring — resist + spring
 *   back    : dragging in from the left edge on a deeper page
 *   none    : not ours (vertical scroll, wrong page, no neighbour…)
 */
export function classifyDrag({
  originX,
  dx,
  dy,
  isPrimary,
  canBack,
  hasNeighbor,
}: {
  /** Where the touch started (viewport px). */
  originX: number
  dx: number
  dy: number
  isPrimary: boolean
  canBack: boolean
  hasNeighbor: boolean
}): DragIntent {
  // Vertical intent wins: the page must scroll, never swipe.
  if (Math.abs(dy) > VERTICAL_ESCAPE && Math.abs(dy) > Math.abs(dx)) return 'none'
  if (Math.abs(dx) < DRAG_SLOP) return 'none'

  if (originX <= EDGE_SWIPE_ZONE) {
    // The edge is spoken for: swipe-back on deeper pages, drawer
    // everywhere else (and a leftward edge swipe is never "back").
    return canBack && dx > 0 ? 'back' : 'none'
  }

  if (!isPrimary) return 'none'
  return hasNeighbor ? 'lateral' : 'rubber'
}

/** Past the end of the ring the page resists instead of stopping dead. */
export function rubberBand(dx: number, max = 64): number {
  return Math.sign(dx) * Math.min(max, Math.abs(dx) * 0.28)
}

/**
 * Did the release commit the gesture?
 * `direction` is the sign the gesture must travel: −1 to move to the
 * next tab / +1 to the previous one (and for swipe-back).
 */
export function commitSwipe({
  travelled,
  velocity,
  width,
  direction,
}: {
  travelled: number
  velocity: number
  width: number
  direction: -1 | 1
}): boolean {
  if (Math.abs(travelled) > width * COMMIT_RATIO) return true
  return Math.abs(velocity) > COMMIT_VELOCITY && Math.sign(velocity) === direction
}

/** Drag-to-dismiss: the drawer closes on a decisive leftward drag. */
export function drawerShouldDismiss(dx: number, velocity: number): boolean {
  if (dx < -DRAWER_DISMISS_DISTANCE) return true
  return velocity < -DRAWER_DISMISS_VELOCITY
}
