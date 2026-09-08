import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

// ────────────────────────────────────────────────────────────────
// Motion primitives — the whole app moves on these.
//
// Rules:
//   • 150–350ms, soft easing, never bounce.
//   • transform + opacity only, so nothing reflows mid-animation.
//   • every animation ends on `transform: none`, so an animated
//     ancestor never becomes a containing block for fixed-position
//     children (modals, toasts, the bottom nav).
//   • reduced motion collapses to a fade — enforced once, app-wide, by
//     <MotionConfig reducedMotion="user"> in App.tsx.
// ────────────────────────────────────────────────────────────────
const EASE = [0.22, 1, 0.36, 1] as const
/** Deceleration used by navigation (push / pop / sheet). */
const EASE_IOS = [0.32, 0.72, 0, 1] as const
/** The one spring for pills, indicators and anything snapping into place. */
const SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.25, ease: EASE } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE } },
}

export const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
}

/** Centred dialog (confirmations, small editors). */
export const dialogVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16, ease: EASE } },
}

/** Bottom sheet — the mobile shape for anything modal. */
export const sheetVariants: Variants = {
  hidden: { opacity: 0, y: '18px', scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.34, ease: EASE_IOS } },
  exit: { opacity: 0, y: '12px', transition: { duration: 0.18, ease: EASE } },
}

/** Full-height side panel (drawer, detail pane). */
export const panelVariants: Variants = {
  hidden: { x: '100%' },
  show: { x: 0, transition: { duration: 0.34, ease: EASE_IOS } },
  exit: { x: '100%', transition: { duration: 0.26, ease: EASE } },
}

/** Backdrop shared by every overlay. */
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

/** Wrap page content for a gentle route-change fade/slide. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Reveal — opt-in scroll entrance for a block of content.
 *
 * Deliberately fail-safe: if IntersectionObserver is missing, the
 * element is never observed, or nothing intersects within 1.2s, the
 * content becomes visible anyway. A reveal animation must never be able
 * to hide a shop's numbers.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div' as ElementType,
}: {
  children: ReactNode
  /** Stagger in ms. */
  delay?: number
  className?: string
  as?: ElementType
}) {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(() =>
    typeof IntersectionObserver === 'undefined' || prefersReducedMotion()
  )

  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            io.disconnect()
          }
        }
      },
      { threshold: 0.01, rootMargin: '0px 0px -6% 0px' }
    )
    io.observe(el)
    // Safety net: never leave content waiting on an observer.
    const failSafe = window.setTimeout(() => setShown(true), 1200)
    return () => {
      io.disconnect()
      window.clearTimeout(failSafe)
    }
  }, [shown])

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(10px)',
        transition: `opacity 420ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 420ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
        willChange: shown ? undefined : 'opacity, transform',
      }}
    >
      {children}
    </Tag>
  )
}

export { motion, AnimatePresence, EASE, EASE_IOS, SPRING }
