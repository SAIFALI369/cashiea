import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * ContextMenu — right-click context menu for any element.
 *
 * Usage:
 *   const [menu, setMenu] = useState<{x: number; y: number} | null>(null)
 *   <div onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }) }}>
 *     <ContextMenu
 *       open={!!menu}
 *       x={menu?.x}
 *       y={menu?.y}
 *       onClose={() => setMenu(null)}
 *       items={[
 *         { label: 'Edit', icon: <Pencil />, onClick: () => handleEdit() },
 *         { label: 'Delete', icon: <Trash />, onClick: () => handleDelete(), danger: true },
 *       ]}
 *     />
 *   </div>
 */

export interface ContextMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  separator?: boolean
}

export function ContextMenu({
  open,
  x,
  y,
  onClose,
  items,
}: {
  open: boolean
  x?: number
  y?: number
  onClose: () => void
  items: ContextMenuItem[]
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!open || x === undefined || y === undefined) return
    // Adjust position so the menu doesn't go off-screen
    const menuW = 180
    const menuH = items.length * 36 + 8
    let px = x
    let py = y
    if (x + menuW > window.innerWidth) px = window.innerWidth - menuW - 8
    if (y + menuH > window.innerHeight) py = window.innerHeight - menuH - 8
    setPosition({ x: px, y: py })
  }, [open, x, y, items.length])

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleScroll = () => onClose()
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('scroll', handleScroll, { capture: true })
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.1 }}
        className="fixed z-[100] min-w-[160px] rounded-control border border-line bg-surface shadow-float py-1.5"
        style={{ left: position.x, top: position.y }}
      >
        {items.map((item, i) =>
          item.separator ? (
            <div key={i} className="h-px bg-line my-1" />
          ) : (
            <button
              key={i}
              onClick={() => { item.onClick(); onClose() }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                item.danger
                  ? 'text-negative hover:bg-negative/10'
                  : 'text-fg hover:bg-surface-2'
              }`}
            >
              {item.icon && <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
            </button>
          ),
        )}
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

/**
 * useContextMenu — hook that manages context menu state.
 * Returns props to spread on the target element + the menu state.
 */
export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const close = () => setMenu(null)

  return {
    menu,
    onContextMenu,
    close,
    isOpen: !!menu,
  }
}
