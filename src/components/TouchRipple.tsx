import { useEffect } from 'react'

/**
 * Global contact-point tap ripple.
 * Mount ONCE. On pointerdown it finds the closest interactive surface
 * (button / link / card / icon-btn) and spawns a soft ripple radiating
 * from the exact touch point — contained to the element, ~520ms, calm.
 * Glyph/visual sizes are untouched; this is pure feedback.
 */
export default function TouchRipple() {
  useEffect(() => {
    const SEL = 'button, a, [role="button"], .card, .icon-btn, .btn-primary, .btn-secondary, .btn-ghost'
    const onDown = (e: PointerEvent) => {
      const target = (e.target as HTMLElement | null)?.closest(SEL) as HTMLElement | null
      if (!target || target.hasAttribute('data-no-ripple')) return
      const rect = target.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const size = Math.max(rect.width, rect.height) * 0.7
      const span = document.createElement('span')
      span.style.cssText =
        `position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:9999px;` +
        `background:rgb(var(--fg));opacity:0.10;transform:translate(-50%,-50%) scale(0);pointer-events:none;` +
        `transition:transform 520ms cubic-bezier(0.22,1,0.36,1),opacity 520ms ease-out;z-index:0;`
      if (getComputedStyle(target).position === 'static') target.style.position = 'relative'
      target.appendChild(span)
      requestAnimationFrame(() => {
        span.style.transform = 'translate(-50%,-50%) scale(1)'
        span.style.opacity = '0'
      })
      window.setTimeout(() => span.remove(), 560)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])
  return null
}
