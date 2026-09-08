import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, type Target, type Transition } from 'framer-motion'
import clsx from 'clsx'
import { ChevronLeft } from 'lucide-react'
import {
  PRIMARY_PAGES,
  PRIMARY_PATHS,
  canSwipeBack,
  fallbackBackTarget,
  lateralNeighbor,
  navDirection,
  type NavDirection,
  type PrimaryPage,
} from '../lib/butterNav'
import {
  EDGE_SWIPE_ZONE,
  classifyDrag,
  commitSwipe,
  rubberBand,
  shouldIgnore,
} from '../lib/gestures'

// ════════════════════════════════════════════════════════════════
// PageStack — butter route transitions + phone gestures.
//
// ── THE ONE INVARIANT ──────────────────────────────────────────
// Exactly ONE page is ever in the DOM.
//
// An earlier revision rendered the outgoing and incoming page at the
// same time (`AnimatePresence mode="popLayout"`) and froze the outgoing
// page's `innerHTML` into a peek layer. That produced the two bugs this
// file replaces:
//
//   1. DOUBLED / SCRAMBLED WORDS — both pages painted over each other
//      while cross-fading, so every heading existed twice on screen.
//      Rapid taps (two nav items in quick succession) left up to THREE
//      page nodes permanently mounted: AnimatePresence never fired the
//      exit completion that unmounts them.
//   2. The frozen `innerHTML` copy lost its React bindings and kept
//      mid-flight inline transforms, so charts, inputs and sticky bars
//      painted scrambled inside the peek layer.
//
// Both are now impossible *by construction*: the route element is keyed
// by pathname with no presence wrapper, so React replaces the subtree
// instead of stacking it. There is nothing left to leak and nothing
// left to duplicate.
//
// ── WHAT REPLACES IT ───────────────────────────────────────────
//   • DIRECTION-AWARE ENTRANCE — push slides over, pop settles forward
//     from underneath, lateral slides in from the correct side,
//     everything else crossfades. Depth without a second page.
//   • LATERAL DRAG (primary tabs) — the page moves 1:1 under the
//     finger and reveals a branded preview of the neighbour tab.
//   • EDGE SWIPE-BACK (deeper pages) — the iOS gesture: drag in from
//     the left edge and the page follows your thumb, the shell dims,
//     release to go back. Primary tabs keep the edge for the drawer.
//   • RUBBER BAND — dragging past the end of the tab ring resists and
//     springs back instead of doing nothing.
//
// Drag transforms are written straight to the DOM (no motion values):
// the hand-over to the live route happens in the same task as the
// `navigate()` call, so there is no frame in which the new page is
// painted with a stale transform.
//
// Reduced motion: entrance collapses to a short crossfade and every
// gesture is disabled.
// ════════════════════════════════════════════════════════════════

/** SwiftUI-style deceleration — fast out of the finger, long settle. */
const EASE_IOS = [0.32, 0.72, 0, 1] as const
/** The app's signature "butter" curve, for anything springing home. */
const EASE_BUTTER = [0.22, 1, 0.36, 1] as const

const TRANSITION_SPRING_BACK = 'transform 340ms cubic-bezier(0.22, 1, 0.36, 1)'
const TRANSITION_COMMIT = 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)'
const TRANSITION_COMMIT_BACK = 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1)'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

interface EnterSpec {
  initial: Target | false
  animate: Target
  transition: Transition
}

/** Entrance for a navigation of this kind. Never animates two pages. */
function enterFor(flow: NavDirection, reduced: boolean): EnterSpec {
  const sign = flow.sign === -1 ? -1 : 1
  if (reduced || flow.kind === 'instant') {
    return {
      initial: flow.kind === 'instant' ? false : { opacity: 0 },
      animate: { opacity: 1, x: 0, y: 0, scale: 1 },
      transition: { duration: flow.kind === 'instant' ? 0 : 0.12, ease: 'linear' },
    }
  }
  switch (flow.kind) {
    case 'push':
      // Deeper page slides over the shell, like a native push.
      return {
        initial: { x: '100%', opacity: 1 },
        animate: { x: 0, opacity: 1 },
        transition: { duration: 0.34, ease: EASE_IOS },
      }
    case 'pop':
      // Coming back up: the layer beneath settles forward.
      return {
        initial: { scale: 0.965, opacity: 0.35 },
        animate: { scale: 1, opacity: 1 },
        transition: { duration: 0.3, ease: EASE_IOS },
      }
    case 'lateral':
      // Sibling tab: slides in from the side you came from.
      return {
        initial: { x: `${22 * sign}%`, opacity: 0.4 },
        animate: { x: 0, opacity: 1 },
        transition: { duration: 0.3, ease: EASE_IOS },
      }
    default:
      return {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.24, ease: EASE_BUTTER },
      }
  }
}

type GestureMode = 'idle' | 'pending' | 'lateral' | 'rubber' | 'back'

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

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

  // ── Direction of THIS navigation, derived during render ──────────
  // Deriving it in an effect (what this file used to do) meant the page
  // mounted with the *previous* navigation's direction for one frame —
  // the push slide never played and the two pages just cross-faded on
  // top of each other. Setting state during render makes React re-run
  // this component before it commits, so the very first painted frame
  // already has the right entrance.
  const prevPathRef = useRef(pathname)
  const pathRef = useRef(pathname)
  const committingRef = useRef(false)
  pathRef.current = pathname
  const [flow, setFlow] = useState<NavDirection>({ kind: 'fade', sign: 0 })
  if (prevPathRef.current !== pathname) {
    const from = prevPathRef.current
    prevPathRef.current = pathname
    setFlow(
      committingRef.current
        ? { kind: 'instant', sign: 0 }
        : reduced
          ? { kind: 'fade', sign: 0 }
          : navDirection(from, pathname)
    )
  }

  // ── Gesture state (mutable; never re-renders on pointermove) ─────
  const gesture = useRef({
    mode: 'idle' as GestureMode,
    origin: 'body' as 'body' | 'edge',
    pointerId: -1,
    startX: 0,
    startY: 0,
    lastT: 0,
    lastX: 0,
    x: 0,
    velocity: 0,
    side: 0 as 1 | -1 | 0,
    page: null as PrimaryPage | null,
    suppressClick: false,
  }).current

  const liveRef = useRef<HTMLDivElement>(null)
  const peekRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const chipRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const timersRef = useRef<number[]>([])

  const [peek, setPeek] = useState<PrimaryPage | null>(null)
  const [peekSide, setPeekSide] = useState<1 | -1>(1)
  const [backing, setBacking] = useState(false)
  const [viewportW, setViewportW] = useState(() =>
    typeof window === 'undefined' ? 390 : window.innerWidth
  )

  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t))
    timersRef.current = []
  }, [])

  const later = useCallback(
    (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms)
      timersRef.current.push(id)
      return id
    },
    []
  )

  useEffect(() => clearTimers, [clearTimers])

  // ── Route change: everything back to rest, instantly ─────────────
  useLayoutEffect(() => {
    const live = liveRef.current
    if (live) {
      // The outgoing page was hidden for the hand-over; the incoming
      // one must be visible before the browser paints this frame.
      live.style.transition = 'none'
      live.style.transform = 'none'
      live.style.visibility = ''
    }
    if (scrimRef.current) scrimRef.current.style.opacity = '0'
    if (chipRef.current) chipRef.current.style.opacity = '0'

    gesture.mode = 'idle'
    gesture.pointerId = -1
    gesture.x = 0
    gesture.velocity = 0
    gesture.page = null
    gesture.suppressClick = false
    busyRef.current = false
    committingRef.current = false
    setPeek(null)
    setBacking(false)

    // Reset scroll WITHOUT the smooth-scroll animation: a page sliding
    // in while the viewport glides up reads as a stutter.
    const html = document.documentElement
    const previous = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    html.style.scrollBehavior = previous
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ── DOM helpers ──────────────────────────────────────────────────
  const place = (el: HTMLElement | null, x: number, transition?: string) => {
    if (!el) return
    el.style.transition = transition ?? 'none'
    el.style.transform = x === 0 ? 'none' : `translate3d(${x}px, 0, 0)`
  }

  const finishTransition = (el: HTMLElement | null, onEnd: () => void, ms: number) => {
    if (!el) {
      onEnd()
      return
    }
    let done = false
    const run = () => {
      if (done) return
      done = true
      el.removeEventListener('transitionend', run)
      onEnd()
    }
    el.addEventListener('transitionend', run)
    later(run, ms + 60) // safety net: a throttled tab must not wedge the shell
  }

  /** Put the live layer back on screen after a committed hand-over. */
  const restoreLive = useCallback(() => {
    const live = liveRef.current
    if (live) {
      live.style.visibility = ''
      live.style.transform = 'none'
      live.style.transition = 'none'
    }
    busyRef.current = false
    gesture.suppressClick = false
  }, [gesture])

  // ── Gesture lifecycle ────────────────────────────────────────────
  const resetDrag = useCallback(
    (springHome: boolean) => {
      const g = gesture
      const side = g.side
      const target = g.page
      g.mode = 'idle'
      g.pointerId = -1

      if (!springHome) {
        place(liveRef.current, 0)
        if (scrimRef.current) scrimRef.current.style.opacity = '0'
        if (chipRef.current) chipRef.current.style.opacity = '0'
        setPeek(null)
        setBacking(false)
        busyRef.current = false
        return
      }

      busyRef.current = true
      place(liveRef.current, 0, TRANSITION_SPRING_BACK)
      if (side && target) place(peekRef.current, side * viewportW, TRANSITION_SPRING_BACK)
      if (scrimRef.current) {
        scrimRef.current.style.transition = 'opacity 340ms cubic-bezier(0.22, 1, 0.36, 1)'
        scrimRef.current.style.opacity = '0'
      }
      if (chipRef.current) {
        chipRef.current.style.transition = 'opacity 240ms ease-out'
        chipRef.current.style.opacity = '0'
      }
      finishTransition(liveRef.current, () => {
        place(liveRef.current, 0)
        if (scrimRef.current) scrimRef.current.style.transition = 'none'
        if (chipRef.current) chipRef.current.style.transition = 'none'
        setPeek(null)
        setBacking(false)
        busyRef.current = false
      }, 340)
    },
    [gesture, later, viewportW]
  )

  /** Lateral commit: the page finishes sliding out, then the live route
   *  takes over in the same task — the new page mounts at rest. */
  const commitLateral = useCallback(
    (target: PrimaryPage) => {
      const g = gesture
      // End the gesture NOW: `lostpointercapture` always follows
      // `pointerup`, and a cancel handler that still sees an active
      // gesture would spring the page back mid-commit.
      g.mode = 'idle'
      busyRef.current = true
      g.suppressClick = true
      const exitX = -(g.side as number) * viewportW
      place(liveRef.current, exitX, TRANSITION_COMMIT)
      place(peekRef.current, 0, TRANSITION_COMMIT)
      finishTransition(liveRef.current, () => {
        const live = liveRef.current
        committingRef.current = true
        if (live) {
          live.style.transition = 'none'
          live.style.transform = 'none'
          // Hide the outgoing page for the hand-over; the layout effect
          // above restores it before the incoming page paints.
          live.style.visibility = 'hidden'
        }
        const routeAtCommit = pathname
        navigate(target.path)
        // Route changed → the layout effect already restored the layer.
        // It did not change (same pathname, e.g. only a query differs) →
        // restore on the next frame instead of leaving the shell hidden.
        // Checked on the SECOND frame, by which point React has
        // certainly committed: if the route changed, the layout effect
        // already restored the layer; if it did not, restore now rather
        // than leave the shell hidden. (One frame is not enough — React
        // may schedule the navigation after the next rAF.)
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (pathRef.current === routeAtCommit) restoreLive()
          })
        )
        later(restoreLive, 320) // last-resort safety net
      }, 220)
    },
    [gesture, later, navigate, pathname, restoreLive, viewportW]
  )

  /** Edge swipe-back commit. */
  const commitBack = useCallback(() => {
    const g = gesture
    g.mode = 'idle' // see commitLateral — pointer capture is about to drop
    busyRef.current = true
    g.suppressClick = true
    place(liveRef.current, viewportW, TRANSITION_COMMIT_BACK)
    finishTransition(liveRef.current, () => {
      const live = liveRef.current
      committingRef.current = true
      if (live) {
        live.style.transition = 'none'
        live.style.transform = 'none'
        live.style.visibility = 'hidden'
      }
      const hasHistory =
        typeof window !== 'undefined' &&
        !!window.history.state &&
        typeof window.history.state.idx === 'number' &&
        window.history.state.idx > 0
      const routeAtCommit = pathname
      if (hasHistory) navigate(-1)
      else navigate(fallbackBackTarget(pathname), { replace: true })
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (pathRef.current === routeAtCommit) restoreLive()
        })
      )
      later(restoreLive, 320)
    }, 200)
  }, [gesture, later, navigate, pathname, restoreLive, viewportW])

  // ── Pointer handlers ─────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (reduced || busyRef.current) return
      if (e.pointerType === 'mouse') return // desktop keeps classical navigation
      if (shouldIgnore(e.target)) return

      const fromEdge = e.clientX <= EDGE_SWIPE_ZONE
      // The left edge means "open the drawer" on primary tabs (handled by
      // useEdgeDrawer) and "go back" on deeper pages (handled here).
      if (fromEdge && !canSwipeBack(pathname)) return
      // Off the edge, only the primary tab ring is draggable.
      if (!fromEdge && !PRIMARY_PATHS.includes(pathname)) return

      const g = gesture
      g.mode = 'pending'
      g.origin = fromEdge ? 'edge' : 'body'
      g.pointerId = e.pointerId
      g.startX = e.clientX
      g.startY = e.clientY
      g.lastT = performance.now()
      g.lastX = 0
      g.x = 0
      g.velocity = 0
      g.side = 0
      g.page = null
      g.suppressClick = false
    },
    [gesture, pathname, reduced]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture
      if (g.mode === 'idle' || e.pointerId !== g.pointerId) return

      const dx = e.clientX - g.startX
      const dy = e.clientY - g.startY

      if (g.mode === 'pending') {
        const neighbor = lateralNeighbor(pathname, dx)
        const intent = classifyDrag({
          originX: g.startX,
          dx,
          dy,
          isPrimary: PRIMARY_PATHS.includes(pathname),
          canBack: canSwipeBack(pathname),
          hasNeighbor: !!neighbor,
        })
        if (intent === 'none') return // not decided yet, or not ours
        g.mode = intent
        if (intent === 'back') {
          setBacking(true)
        } else if (intent === 'lateral' && neighbor) {
          g.side = dx < 0 ? 1 : -1
          g.page = neighbor
          setPeekSide(g.side)
          setPeek(neighbor)
        }
        // Own the pointer only once the gesture is unambiguously ours,
        // so a plain tap still reaches the button underneath.
        try {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        } catch {
          /* older browsers: tracking continues without capture */
        }
      }

      const now = performance.now()
      const dt = now - g.lastT
      let x = 0
      if (g.mode === 'lateral') {
        x = clamp(dx, -viewportW, viewportW)
        place(liveRef.current, x)
        place(peekRef.current, x + (g.side as number) * viewportW)
      } else if (g.mode === 'rubber') {
        x = rubberBand(dx)
        place(liveRef.current, x)
      } else if (g.mode === 'back') {
        x = clamp(dx, 0, viewportW)
        place(liveRef.current, x)
        const progress = x / viewportW
        if (scrimRef.current) scrimRef.current.style.opacity = String(0.55 * progress)
        if (chipRef.current) {
          chipRef.current.style.opacity = String(Math.min(1, progress * 2.2))
          chipRef.current.style.transform = `translate3d(${x * 0.55}px, -50%, 0)`
        }
      } else {
        return
      }

      if (dt > 0) {
        g.velocity = ((x - g.lastX) / dt) * 1000
        g.lastT = now
        g.lastX = x
      }
      g.x = x
      if (Math.abs(x) > 8) g.suppressClick = true
    },
    [gesture, pathname, viewportW]
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const g = gesture
      if (busyRef.current) return
      if (g.mode === 'idle' || e.pointerId !== g.pointerId) return

      if (g.mode === 'lateral' && g.page) {
        const commit = commitSwipe({
          travelled: g.x,
          velocity: g.velocity,
          width: viewportW,
          // A drag to the left (side = +1) commits by travelling left.
          direction: g.side === 1 ? -1 : 1,
        })
        if (commit) commitLateral(g.page)
        else resetDrag(true)
        return
      }
      if (g.mode === 'back') {
        const commit = commitSwipe({
          travelled: g.x,
          velocity: g.velocity,
          width: viewportW,
          direction: 1,
        })
        if (commit) commitBack()
        else resetDrag(true)
        return
      }
      // 'pending' never moved the page, so there is nothing to spring
      // home — clearing instantly keeps rapid taps responsive.
      resetDrag(g.mode === 'rubber')
    },
    [commitBack, commitLateral, gesture, resetDrag, viewportW]
  )

  const onPointerCancel = useCallback(() => {
    if (busyRef.current) return
    if (gesture.mode !== 'idle') resetDrag(gesture.mode !== 'pending')
  }, [gesture, resetDrag])

  // Swallow the ghost click that follows a drag: a link under the
  // finger must not fire when the gesture was a swipe.
  useEffect(() => {
    if (!peek && !backing) return
    const swallow = (e: MouseEvent) => {
      if (gesture.suppressClick) {
        e.stopPropagation()
        e.preventDefault()
        gesture.suppressClick = false
      }
    }
    document.addEventListener('click', swallow, { capture: true })
    return () => document.removeEventListener('click', swallow, { capture: true })
  }, [backing, gesture, peek])

  const enter = enterFor(flow, reduced)

  return (
    <div
      className={clsx('relative min-w-0 w-full', fullBleed && 'flex-1 flex flex-col min-h-0')}
      // `clip` (not `hidden`): hides the sliding page when it overshoots
      // WITHOUT creating a scroll container — in-page sticky bars (POS
      // cart, search headers) keep working.
      style={{ overflowX: 'clip', overscrollBehaviorX: 'none' }}
    >
      {/* ── Shell revealed behind an edge swipe-back ── */}
      <div
        ref={scrimRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-paper-deep opacity-0"
      />

      {/* ── Lateral peek: a branded preview of the neighbour tab.
             Deliberately NOT a copy of the live page — see the header
             note. Nothing on screen is ever rendered twice. ── */}
      {peek && (
        <div
          ref={peekRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-paper"
        >
          <PeekPreview page={peek} />
        </div>
      )}

      {/* ── Edge swipe-back affordance ── */}
      {backing && (
        <div
          ref={chipRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 z-20 flex items-center gap-1 rounded-full border border-line bg-surface/90 py-2 pl-1.5 pr-3 opacity-0 shadow-float backdrop-blur"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-soft text-secondary-strong">
            <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="text-xs font-semibold text-fg">Back</span>
        </div>
      )}

      {/* ── The live page. Exactly one, always. ── */}
      <div
        ref={liveRef}
        className={clsx('relative z-10 min-w-0 w-full', fullBleed && 'flex-1 flex flex-col min-h-0')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
      >
        <motion.div
          key={pathname}
          initial={enter.initial}
          animate={enter.animate}
          transition={enter.transition}
          data-butter-page={pathname}
          className={clsx('relative min-w-0 w-full', fullBleed && 'flex-1 flex flex-col min-h-0')}
        >
          <div className={fullBleed ? 'flex-1 flex flex-col min-h-0' : undefined}>{children}</div>
        </motion.div>
      </div>
    </div>
  )
}

// ── Branded preview of a neighbour tab ──────────────────────────────
function PeekPreview({ page }: { page: PrimaryPage }) {
  const Icon = page.icon
  const index = PRIMARY_PATHS.indexOf(page.path)
  return (
    <div className="flex h-full w-full select-none flex-col items-center justify-center gap-5 bg-paper px-8">
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-line bg-surface shadow-float">
          <Icon className="h-9 w-9 text-accent" strokeWidth={1.6} />
        </div>
      </div>
      <div className="text-center">
        <p className="text-base font-bold text-fg">{page.label}</p>
        <p className="mt-1 text-xs text-fg-subtle">Release to open</p>
      </div>
      {/* Quiet content skeleton so the preview never looks empty. */}
      <div className="w-full max-w-[240px] space-y-2.5" aria-hidden="true">
        <div className="h-2 w-3/4 rounded-full bg-line/70" />
        <div className="h-2 w-full rounded-full bg-line/50" />
        <div className="h-2 w-2/3 rounded-full bg-line/40" />
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {PRIMARY_PAGES.map((p, i) => (
          <span
            key={p.path}
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
