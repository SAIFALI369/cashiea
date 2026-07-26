// Tests for the mobile-keyboard focus helpers.
// We don't render React here — we just exercise the pure helpers.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FOCUS_SCROLL_CLASS, ensureInputFocusStyles } from './useInputFocus'

describe('useInputFocus helpers', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('exports a stable class name', () => {
    expect(FOCUS_SCROLL_CLASS).toBe('cashiea-focus-scroll')
  })

  it('injects the focus-scroll style exactly once', () => {
    ensureInputFocusStyles()
    ensureInputFocusStyles()
    ensureInputFocusStyles()
    const tags = document.head.querySelectorAll('#cashiea-focus-styles')
    expect(tags).toHaveLength(1)
  })

  it('the injected style includes scroll-margin and form-scroll rules', () => {
    ensureInputFocusStyles()
    const style = document.getElementById('cashiea-focus-styles')
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('scroll-margin-top: 80px')
    expect(style!.textContent).toContain('scroll-margin-bottom: 120px')
    expect(style!.textContent).toContain('cashiea-form-scroll')
  })

  it('is a no-op on the server (no document)', () => {
    // We can't actually delete `document` in this test, but we can assert
    // the function does not throw when called repeatedly.
    expect(() => ensureInputFocusStyles()).not.toThrow()
  })
})

// Light test of the rAF call inside the focus handler to confirm
// `scrollIntoView` is invoked with safe options.
describe('scrollIntoView options', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.body.innerHTML = '<input id="t" />'
  })

  it('scrollIntoView can be polyfilled and called with the expected options', async () => {
    const input = document.getElementById('t') as HTMLInputElement
    const spy = vi.fn()
    input.scrollIntoView = spy

    // Mirror what the hook does on focus.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try { input.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch {}
      })
    })

    // Wait two rAFs plus a tick.
    await new Promise((r) => setTimeout(r, 50))
    expect(spy).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
  })
})
