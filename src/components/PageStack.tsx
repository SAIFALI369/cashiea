import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  type Variants,
} from 'framer-motion'
import clsx from 'clsx'
import {
  PRIMARY_PATHS,
  getSnapshot,
  lateralNeighbor,
  navDirection,
  saveSnapshot,
  type NavDirection,
  type PrimaryPage,
} from '../lib/butterNav'
import { shouldIgnore, EDGE_SWIPE_ZONE } from '../lib/useSwipeNavigation'

// ════════════════════════════════════════════════════════════════
// PageStack — butter route transitions.
//
// Why this exists (audit finding): the layout used
// `AnimatePresence mode="wait"`, so the old page fully exited BEFORE
// the new page entered — a blank beat between pages, and the two
// pages were never visible together. PageStack fixes both:
//
//   • PARALLEL TRANSITIONS — `mode="popLayout"` keeps the outgoing
//     page mounted while the incoming one slides in, so both pages
//     are on screen, moving together (native navigation feel).
//     Direction-aware: push (deeper) slides the new page over, pop
//     slides it away to reveal the page beneath, lateral (primary
//     tabs) slides both the same way, everything else crossfades.
//
//   • INTERACTIVE DRAG — on touch, dragging a primary tab sideways
//     reveals the REAL neighbour page under your finger, 1:1, using
//     a frozen snapshot taken when you last left that page (no
//     double data-fetch). Release past the threshold (or fling) and
//     the swipe commits seamlessly into the live page; release early
//     and it springs back. The left edge stays reserved for the
//     sidebar drawer gesture.
//
// Reduced motion: everything collapses to a plain crossfade and the
// interactive drag is disabled.
// ════════════════════════════════════════════════════════════════

const SPRING = { type: 'spring', stiffness: 380, damping: 40, mass: 0.9 } as const
const EASE_SWIPE = [0.16, 1, 0.3, 1] as const

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface FlowCtx extends NavDirection {}

const pageVariants: Variants = {
  enter: (c: FlowCtx) => {
    switch (c.kind) {
      case 'push':
        return { x: '100%', opacity: 1, zIndex: 2, boxShadow: '-10px 0 32px -8px rgb(var(--shadow) / 0.22)' }
      case 'pop':
        return { x: '-24%', scale: 0.94, opacity: 0.5, zIndex: 1 }
      case 'lateral':
        return { x: 34 * c.sign + '%', opacity: 0, zIndex: 2 }
      default:
        return { opacity: 0, y: 8, zIndex: 2 }
    }
  },
  center: {
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    zIndex: 1,
    boxShadow: '0 0 0 0 rgb(var(--shadow) / 0)',
    transition: SPRING,
  },
  exit: (c: FlowCtx) => {
    switch (c.kind) {
      case 'push':
        return { x: '-24%', scale: 0.94, opacity: 0.45, zIndex: 1, transition: SPRING }
      case 'pop':
        return { x: '100%', opacity: 1, zIndex: 2, boxShadow: '-10px 0 32px -8px rgb(var(--shadow) / 0.22)', transition: SPRING }
      case 'lateral':
        return { x: -28 * c.sign + '%', opacity: 0, zIndex: 1, transition: { duration: 0.26, ease: EASE_SWIPE } }
      case 'instant':
        // A committed drag already played the transition under the
        // finger — swap the pages with no exit animation at all.
        return { opacity: 1, zIndex: 0, transition: { duration: 0 } }
      default:
        return { opacity: 0, zIndex: 1, transition: { duration: 0.18 } }
    }
  },
}

const fadeOnlyVariants: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: 0.16 } },
  exit: { opacity: 0, transition: { duration: 0.16 } },
}

/** Which neighbour page a drag is currently revealing, and on which side. */
interface DragTarget {
  page: PrimaryPage
  /** +1 neighbour sits to the right (next tab), −1 to the left (prev). */
  side: 1 | -1
}

export default function PageStack({
  pathname,
  fullBleed = false,
  children,
}: {
  pathname: string
  /** Full-bleed pages (Meraj assistant) fill the shell and scroll internally. */
  fullBleed?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  const reduced = prefersReducedMotion()

  // ── Direction of the current navigation ──
  const prevPathRef = useRef(pathname)
  const [flow, setFlow] = useState<FlowCtx>({ kind: 'fade', sign: 0 })
  // After a committed drag the new page is already on screen at rest —
  // mount it without replaying an entrance animation.
  const [skipEntrance, setSkipEntrance] = useState(false)
  const committingRef = useRef(false)

  // ── Drag state ──
  const x = useMotionValue(0)
  const [dragTarget, setDragTarget] = useState<DragTarget | null>(null)
  const [viewportW, setViewportW] = useState(() =>
    typeof window === 'undefined' ? 390 : window.innerWidth
  )
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const dragRef = useRef({
    active: false,
    horizontal: false,
    dead: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastT: 0,
    lastX: 0,
    velocity: 0,
    suppressClick: false,
  })

  // Peek layer rides along 1:1 with the finger.
  const peekX = useTransform(x, (v) => v + (dragTarget ? dragTarget.side * viewportW : 0))

  useLayoutEffect(() => {
    const from = prevPathRef.current
    if (from !== pathname) {
      // A committed drag already animated the hand-over under the
      // finger — swap pages instantly instead of replaying a slide.
      const committed = committingRef.current
      setFlow(
        committed
          ? { kind: 'instant', sign: 0 }
          : reduced
            ? { kind: 'fade', sign: 0 }
            : navDirection(from, pathname)
      )
      prevPathRef.current = pathname
      window.scrollTo(0, 0)
      if (committed) {
        // Same frame, before paint: the new live page is already in
        // the tree — snap the layer home and drop the peek so the
        // swap is invisible (peek showed this very page's snapshot).
        x.jump(0)
        setDragTarget(null)
        requestAnimationFrame(() => setSkipEntrance(false))
      }
      committingRef.current = false

      // Freeze the page we are leaving — one tick later. React has
      // already detached the original subtree by the time this effect
      // runs, but AnimatePresence mounts the exiting clone (tagged
      // with data-butter-page) on the very next frame, well before
      // its exit animation finishes. Capture from the live clone.
      const captureFrom = from
      requestAnimationFrame(() => {
        const leaving = document.querySelector<HTMLElement>(
          `[data-butter-page="${captureFrom}"]`
        )
        if (leaving) saveSnapshot(captureFrom, leaving.innerHTML)
      })
    }
  }, [pathname, reduced, x])

  const endDrag = useCallback(
    (commit: boolean) => {
      const d = dragRef.current
      const target = dragTarget
      d.active = false
      d.horizontal = false
      d.dead = false
      if (!commit || !target) {
        animate(x, 0, { type: 'spring', stiffness: 420, damping: 38 })
        setDragTarget(null)
        return
      }
      // Commit: slide fully to the neighbour, then hand over to the
      // live route — which mounts instantly, already in place.
      committingRef.current = true
      setSkipEntrance(true)
      const dir = target.side // +1: current page exits left
      const exitX = -dir * viewportW
      animate(x, exitX, { duration: 0.22, ease: EASE_SWIPE }).then(() => {
        navigate(target.page.path)
      })
      // If no ghost click shows up, re-arm the swallow for next time.
      window.setTimeout(() => {
        dragRef.current.suppressClick = false
      }, 350)
    },
    [dragTarget, navigate, viewportW, x]
  )

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (reduced) return
      if (e.pointerType === 'mouse') return // desktop keeps classic navigation
      if (!PRIMARY_PATHS.includes(pathname)) return
      // The left edge belongs to the sidebar drawer gesture.
      if (e.clientX <= EDGE_SWIPE_ZONE) return
      if (shouldIgnore(e.target)) return
      const d = dragRef.current
      d.active = true
      d.horizontal = false
      d.dead = false
      d.pointerId = e.pointerId
      d.startX = e.clientX
      d.startY = e.clientY
      d.lastT = performance.now()
      d.lastX = 0
      d.velocity = 0
      d.suppressClick = false
    },
    [pathname, reduced]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d.active || e.pointerId !== d.pointerId) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      if (!d.horizontal) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          // Vertical intent — hand the gesture back to native scroll.
          d.active = false
          return
        }
        if (Math.abs(dx) > 14) {
          const neighbor = lateralNeighbor(pathname, dx)
          if (!neighbor) {
            d.active = false // at the end of the ring
            return
          }
          d.horizontal = true
          setDragTarget({ page: neighbor, side: dx < 0 ? 1 : -1 })
        }
        return
      }
      // 1:1 lockstep, clamped to one viewport width.
      const clamped = Math.max(-viewportW, Math.min(viewportW, dx))
      const now = performance.now()
      const dt = now - d.lastT
      if (dt > 0) {
        d.velocity = ((clamped - d.lastX) / dt) * 1000
        d.lastT = now
        d.lastX = clamped
      }
      if (Math.abs(clamped) > 8) d.suppressClick = true
      x.set(clamped)
    },
    [pathname, viewportW, x]
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d.active || e.pointerId !== d.pointerId) return
      if (!d.horizontal) {
        d.active = false
        return
      }
      const travelled = x.get()
      const side = dragTarget?.side ?? 0
      const flinging = Math.abs(d.velocity) > 480 && Math.sign(d.velocity) === -side
      const farEnough = Math.abs(travelled) > viewportW * 0.28
      endDrag(farEnough || flinging)
    },
    [dragTarget, endDrag, viewportW, x]
  )

  const onPointerCancel = useCallback(() => {
    if (dragRef.current.horizontal) endDrag(false)
    else dragRef.current.active = false
  }, [endDrag])

  // Swallow the ghost click that follows a horizontal drag (a link
  // under the finger must not fire when the gesture was a swipe).
  useEffect(() => {
    if (!dragTarget) return
    const swallow = (e: MouseEvent) => {
      if (dragRef.current.suppressClick) {
        e.stopPropagation()
        e.preventDefault()
        dragRef.current.suppressClick = false
      }
    }
    document.addEventListener('click', swallow, { capture: true })
    return () => document.removeEventListener('click', swallow, { capture: true })
  }, [dragTarget])

  const snapshotHtml = dragTarget ? getSnapshot(dragTarget.page.path) : null
  const variants = reduced ? fadeOnlyVariants : pageVariants

  return (
    <div
      className={clsx('relative min-w-0 w-full', fullBleed && 'flex-1 flex flex-col min-h-0')}
      // `clip` (not `hidden`): hides the sliding pages that overshoot
      // horizontally WITHOUT creating a scroll container — in-page
      // sticky bars (POS cart, search headers) keep working.
      style={{ overflowX: 'clip' }}
    >
      {/* ── Peek layer: the real neighbour page (or a branded preview)
             revealed under the finger during a lateral drag ── */}
      <AnimatePresence>
        {dragTarget && (
          <motion.div
            key={dragTarget.page.path}
            className="absolute inset-0 z-0 overflow-hidden bg-paper pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            style={{ x: peekX }}
            aria-hidden="true"
          >
            {snapshotHtml ? (
              <div
                className="w-full h-full overflow-hidden select-none"
                dangerouslySetInnerHTML={{ __html: snapshotHtml }}
              />
            ) : (
              <PeekPreview page={dragTarget.page} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Live page (draggable over the peek layer) ── */}
      <motion.div
        className={clsx('relative z-10 min-w-0 w-full', fullBleed && 'flex-1 flex flex-col min-h-0')}
        style={{ x }}
        onPointerDown={(e) => {
          // Keep vertical page scrolling native while allowing horizontal swipes.
          if (e.pointerType !== 'mouse') e.currentTarget.setPointerCapture(e.pointerId)
          onPointerDown(e)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={flow}>
          <motion.div
            key={pathname}
            custom={flow}
            variants={variants}
            initial={skipEntrance ? false : 'enter'}
            animate="center"
            exit="exit"
            data-butter-page={pathname}
            // `relative` matters: z-index from the variants only applies
            // to positioned elements, and it decides whether the
            // incoming page covers the outgoing one (push) or slides
            // out from under it (pop).
            className={clsx('relative min-w-0 w-full', fullBleed && 'flex-1 flex flex-col min-h-0')}
          >
            <div className={fullBleed ? 'flex-1 flex flex-col min-h-0' : undefined}>
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

// ── Branded preview for a neighbour page we have not visited yet ──
function PeekPreview({ page }: { page: PrimaryPage }) {
  const Icon = page.icon
  const index = PRIMARY_PATHS.indexOf(page.path)
  return (
    <div className="w-full h-full bg-paper flex flex-col items-center justify-center gap-4 select-none">
      <div className="relative">
        <div className="absolute -inset-5 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative w-20 h-20 rounded-3xl bg-surface border border-line shadow-float flex items-center justify-center">
          <Icon className="w-9 h-9 text-accent" strokeWidth={1.6} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-base font-bold text-fg">{page.label}</p>
        <p className="text-xs text-fg-subtle mt-1">Release to open</p>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {PRIMARY_PATHS.map((p, i) => (
          <span
            key={p}
            className={clsx(
              'h-1.5 rounded-full transition-all',
              i === index ? 'w-5 bg-accent' : 'w-1.5 bg-line-2'
            )}
          />
        ))}
      </div>
    </div>
  )
}
