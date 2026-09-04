import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// ════════════════════════════════════════════════════════════════
// useSwipeNavigation — swipe left/right to move between the primary
// mobile pages, mirroring the bottom-nav order:
//
//   Today  →  New Sale  →  Customers  →  Scan (Meraj)
//   ← swipe right goes back the same way
//
// Rules that keep it out of the way:
//   • active only below the lg sidebar breakpoint (the mobile shell)
//   • needs a decisive horizontal fling (≥72px, clearly more
//     horizontal than vertical) — vertical page scroll never triggers
//   • ignored over dialogs, overlays (fixed inset-0), inputs,
//     horizontally-scrollable rows (chips, tiles), the bottom nav,
//     the sidebar drawer, and anything marked data-no-swipe-nav
//   • swipes that START at the left screen edge (≤36px) are reserved
//     for the drawer gesture (useEdgeDrawer) and never navigate
// ════════════════════════════════════════════════════════════════

export const SWIPE_PAGES = ['/app', '/app/pos', '/app/customers', '/app/assistant']

export const EDGE_SWIPE_ZONE = 36
const MIN_DX = 72
const MAX_DY = 60

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

/**
 * @deprecated Lateral swipe navigation now lives in PageStack
 * (interactive drag with the neighbour page revealed under the
 * finger). This fling-only hook is kept for reference/compat.
 */
export function useSwipeNavigation() {
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    // Desktop shell (sidebar, ≥1024px) keeps mouse/classical navigation.
    const mobile = window.matchMedia('(max-width: 1023px)')
    if (!mobile.matches) return
    if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) return

    let startX = 0
    let startY = 0
    let startTime = 0
    let active = false
    let ignored = false

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { active = false; return }
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      startTime = Date.now()
      ignored = startX <= EDGE_SWIPE_ZONE || shouldIgnore(e.target)
      active = true
    }

    const onEnd = (e: TouchEvent) => {
      if (!active || ignored) { active = false; return }
      active = false
      const touch = e.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      const dt = Date.now() - startTime
      if (dt > 1200) return                       // too slow to be a fling
      if (Math.abs(dx) < MIN_DX) return           // too small
      if (Math.abs(dy) > MAX_DY) return           // mostly vertical
      if (Math.abs(dx) < Math.abs(dy) * 1.5) return

      const index = SWIPE_PAGES.indexOf(location.pathname)
      if (index === -1) return
      const next = dx < 0 ? index + 1 : index - 1
      if (next < 0 || next >= SWIPE_PAGES.length) return
      navigate(SWIPE_PAGES[next])
    }

    const onCancel = () => { active = false }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
    }
  }, [location.pathname, navigate])
}

// ════════════════════════════════════════════════════════════════
// useEdgeDrawer — swipe in from the LEFT EDGE to slide the sidebar
// drawer in; swipe LEFT (or tap the backdrop) to slide it away.
// Edge-originated swipes are excluded from page navigation above.
// ════════════════════════════════════════════════════════════════

export function useEdgeDrawer({
  isOpen,
  onOpen,
  onClose,
}: {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 1023px)')
    if (!mobile.matches) return
    if (!('ontouchstart' in window || navigator.maxTouchPoints > 0)) return

    let startX = 0
    let startY = 0
    let fromEdge = false
    let active = false

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { active = false; return }
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      fromEdge = startX <= EDGE_SWIPE_ZONE
      active = true
    }

    const onEnd = (e: TouchEvent) => {
      if (!active) { active = false; return }
      active = false
      const touch = e.changedTouches[0]
      if (!touch) return
      const dx = touch.clientX - startX
      const dy = touch.clientY - startY
      if (Math.abs(dy) > MAX_DY) return
      if (Math.abs(dx) < 56) return

      if (isOpen && dx < 0) {
        // Drawer open: swipe left anywhere slides it away.
        onClose()
      } else if (!isOpen && fromEdge && dx > 0) {
        // Closed: swipe right from the left edge slides it in.
        onOpen()
      }
    }

    const onCancel = () => { active = false }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
    }
  }, [isOpen, onOpen, onClose])
}
