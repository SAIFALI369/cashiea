import { useEffect } from 'react'
import { EDGE_SWIPE_ZONE, shouldIgnore } from './gestures'

// ════════════════════════════════════════════════════════════════
// useEdgeDrawer — swipe in from the LEFT EDGE to slide the sidebar
// drawer in; swipe LEFT to slide it away.
//
// Every threshold and guard rail lives in ./gestures so this can never
// disagree with PageStack about who owns a touch.
//
// `enabled` is false on pages where the edge belongs to swipe-back
// (butterNav.canSwipeBack), so the two gestures never fight.
//
// The old fling-only page-navigation hook is gone: two systems
// listening for the same swipe is how gestures start double-firing.
// ════════════════════════════════════════════════════════════════

export { EDGE_SWIPE_ZONE, shouldIgnore }

const MAX_DY = 60

export function useEdgeDrawer({
  isOpen,
  onOpen,
  onClose,
  enabled = true,
}: {
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  /** False when another gesture owns the left edge on this page. */
  enabled?: boolean
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
      if (isOpen) {
        // Drawer open: a left swipe anywhere dismisses it.
        active = true
        return
      }
      // Drawer closed: only a clean swipe that starts on the reserved
      // edge is ours — and only on pages that don't give the edge to
      // swipe-back.
      active = enabled && fromEdge && !shouldIgnore(e.target)
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

      if (isOpen && dx < 0) onClose()
      else if (!isOpen && fromEdge && dx > 0) onOpen()
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
  }, [enabled, isOpen, onClose, onOpen])
}
