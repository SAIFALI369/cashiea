import { useEffect, useState } from 'react'

/**
 * useIsDesktop — tracks whether the viewport is at the desktop breakpoint (lg, ≥1024px).
 * Used so we can render the desktop shell (top header + 7-item bottom nav + full-screen Meraj)
 * vs the mobile shell (sticky mobile header + 5-item bottom nav).
 *
 * SSR-safe: defaults to false on the server / before mount, then updates on the client
 * so hydration matches the mobile layout (which is what the Tailwind classes do too).
 */
export function useIsDesktop(breakpoint = 1024): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(`(min-width: ${breakpoint}px)`).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${breakpoint}px)`)
    const handler = () => setIsDesktop(mql.matches)
    handler()
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])

  return isDesktop
}
