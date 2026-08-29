import { useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import { Trash2, X } from 'lucide-react'

/**
 * SwipeToDelete — swipe-to-delete gesture for list items (mobile).
 * Swipe left to reveal a delete button, swipe far enough to auto-trigger.
 *
 * Usage:
 *   <SwipeToDelete onDelete={() => remove(id)}>
 *     <div>Your card content</div>
 *   </SwipeToDelete>
 */
export function SwipeToDelete({
  children,
  onDelete,
  threshold = 120,
  className = '',
}: {
  children: ReactNode
  onDelete: () => void
  threshold?: number
  className?: string
}) {
  const x = useMotionValue(0)
  const bgOpacity = useTransform(x, [-threshold, -40, 0], [1, 0.5, 0])
  const iconScale = useTransform(x, [-threshold, -40, 0], [1.2, 0.8, 0.5])
  const hasTriggered = useRef(false)

  return (
    <div className={`relative overflow-hidden rounded-card ${className}`}>
      {/* Delete background (revealed when swiping left) */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute inset-0 bg-negative flex items-center justify-end pr-6"
      >
        <motion.div style={{ scale: iconScale }} className="flex items-center gap-2 text-white">
          <Trash2 className="w-5 h-5" />
          <span className="text-sm font-bold">Delete</span>
        </motion.div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -threshold * 1.5, right: 0 }}
        dragElastic={{ left: 0.4, right: 0 }}
        style={{ x }}
        onDragStart={() => { hasTriggered.current = false }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -threshold && !hasTriggered.current) {
            hasTriggered.current = true
            onDelete()
          } else {
            // Snap back
            x.set(0)
          }
        }}
        className="relative bg-surface"
      >
        {children}
      </motion.div>
    </div>
  )
}

/**
 * SwipeActions — swipe to reveal custom action buttons (not just delete).
 * Swipe left to reveal action buttons that stay until tapped or dismissed.
 *
 * Usage:
 *   <SwipeActions actions={[
 *     { icon: <Pencil />, label: 'Edit', color: 'bg-accent', onClick: () => edit() },
 *     { icon: <Trash2 />, label: 'Delete', color: 'bg-negative', onClick: () => remove() },
 *   ]}>
 *     <div>Your card content</div>
 *   </SwipeActions>
 */
export function SwipeActions({
  children,
  actions,
  className = '',
}: {
  children: ReactNode
  actions: { icon: ReactNode; label: string; color: string; onClick: () => void }[]
  className?: string
}) {
  const x = useMotionValue(0)
  const actionWidth = actions.length * 64
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={containerRef} className={`relative overflow-hidden rounded-card ${className}`}>
      {/* Action buttons background */}
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: actionWidth }}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => { action.onClick(); x.set(0) }}
            className={`flex-1 flex flex-col items-center justify-center gap-1 ${action.color} text-white`}
          >
            <span className="w-5 h-5 flex items-center justify-center">{action.icon}</span>
            <span className="text-[10px] font-semibold">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -actionWidth, right: 0 }}
        dragElastic={{ left: 0.1, right: 0 }}
        style={{ x }}
        className="relative bg-surface"
      >
        {children}
      </motion.div>
    </div>
  )
}
