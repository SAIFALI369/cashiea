import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * HeaderAction — teleports a page's primary action into the mobile app
 * header (the `#app-header-action` slot rendered by AppLayout).
 *
 * Why: the redesign puts one large bold page title on the left of the
 * top bar and the single primary action (usually a compact + icon) on
 * the right. Pages shouldn't spend 20% of the screen on an "Add …"
 * button, and they shouldn't repeat their own title in the body.
 *
 * On desktop (≥lg) the slot doesn't exist visually, so children render
 * inline instead via `desktop`, keeping the wide layout untouched.
 */
export default function HeaderAction({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // The slot lives in AppLayout's header; it may mount a tick later
    // than the page on a cold route load, so retry once on the next frame.
    const find = () => setHost(document.getElementById('app-header-action'))
    find()
    const id = requestAnimationFrame(find)
    return () => cancelAnimationFrame(id)
  }, [])

  if (!host) return null
  return createPortal(children, host)
}
