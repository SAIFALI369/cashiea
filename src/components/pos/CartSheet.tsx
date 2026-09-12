import { useRef, useState, type ReactNode } from 'react'

/**
 * CartSheet — the dynamic bottom sheet that holds the cart on mobile.
 *
 * It rises with a slight overshoot, and it can be pushed back down with
 * the same gesture that opened it: drag the handle (or anywhere in the
 * header area) and release past the dismiss distance. Dragging tracks
 * the finger 1:1 while it is down, so the sheet feels attached rather
 * than animated at you.
 *
 * The body is a normal scroll container — the drag only starts from the
 * grab area, so flicking through a long cart never dismisses the sheet.
 */
const DISMISS_PX = 110

export function CartSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef<number | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current == null) return
    // Downward only; an upward pull just holds at the top.
    setDy(Math.max(0, e.clientY - startY.current))
  }
  const finish = () => {
    if (startY.current == null) return
    const shouldClose = dy > DISMISS_PX
    startY.current = null
    setDragging(false)
    setDy(0)
    if (shouldClose) onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 lg:hidden flex items-end"
      onClick={onClose}
      role="dialog"
      aria-label="Cart and checkout"
    >
      <div
        className={`${dragging ? '' : 'pos-sheet'} bg-surface w-full rounded-t-[24px] max-h-[92vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: dy ? `translateY(${dy}px)` : undefined,
          transition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        {/* Grab area: the handle plus the padding around it */}
        <div
          className="pt-2 pb-1 flex justify-center flex-shrink-0 cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
        >
          <button onClick={onClose} aria-label="Close cart" className="py-2.5 px-12 flex justify-center">
            <span className="w-10 h-1 rounded-full bg-line-2" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  )
}
