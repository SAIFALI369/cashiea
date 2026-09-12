// ════════════════════════════════════════════════════════════════
// useSwipeAction — horizontal swipe on a list row to reveal or fire
// an action (delete a cart line, refund a sale…).
//
// Deliberately conservative, because these rows live inside vertically
// scrolling sheets: the gesture only takes over once the pointer has
// moved further horizontally than vertically, so a normal scroll is
// never hijacked. Below the commit threshold the row springs back.
// ════════════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from 'react'

/** Past this many px the swipe counts as committed on release. */
export const SWIPE_COMMIT_PX = 96
/** Row cannot be dragged further than this, so it never leaves the screen. */
const MAX_DRAG = 132
/** Horizontal travel before we claim the gesture from the scroller. */
const CLAIM_PX = 10

export interface SwipeState {
  /** Current horizontal offset in px (negative = dragged left). */
  dx: number
  /** True while the finger is down and the gesture is ours. */
  dragging: boolean
  /** True once dx passes the commit threshold — colour the action. */
  armed: boolean
}

export function useSwipeAction(onCommit: () => void, enabled = true) {
  const [state, setState] = useState<SwipeState>({ dx: 0, dragging: false, armed: false })
  const start = useRef<{ x: number; y: number } | null>(null)
  const claimed = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled || e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY }
    claimed.current = false
  }, [enabled])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y

    if (!claimed.current) {
      // Vertical intent wins: let the sheet scroll and drop the gesture.
      if (Math.abs(dy) > Math.abs(dx)) { start.current = null; return }
      if (Math.abs(dx) < CLAIM_PX) return
      claimed.current = true
    }

    // Only left swipes act; a right drag just rubber-bands to zero.
    const clamped = Math.max(-MAX_DRAG, Math.min(0, dx))
    setState({ dx: clamped, dragging: true, armed: clamped <= -SWIPE_COMMIT_PX })
  }, [])

  const finish = useCallback(() => {
    if (!start.current && !claimed.current) { setState({ dx: 0, dragging: false, armed: false }); return }
    const committed = state.armed
    start.current = null
    claimed.current = false
    setState({ dx: 0, dragging: false, armed: false })
    if (committed) onCommit()
  }, [state.armed, onCommit])

  return {
    ...state,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onPointerLeave: finish,
    },
  }
}
