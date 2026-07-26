// ════════════════════════════════════════════════════════════════════════════
// useInputFocus — keeps the focused input visible when the mobile keyboard
// opens so the keyboard doesn't auto-dismiss after the first character.
//
// Why this exists
// ───────────────
// On iOS Safari and some Android browsers, when an <input> receives focus
// and the on-screen keyboard opens, the visual viewport shrinks. If the
// focused element ends up partially or fully outside the new visible
// viewport, the browser auto-blurs the input and dismisses the keyboard
// after the first character. This is the "keypad hides after one letter"
// bug reported on the Cashiea login/signup pages.
//
// Fix
// ───
// 1. Add a small `scroll-margin-top` to focused elements so any
//    `scrollIntoView` call (including the browser's own native one) lands
//    the input comfortably inside the visible viewport rather than flush
//    against the keyboard.
// 2. On `focus`, explicitly scroll the input into the centre of the
//    visible viewport. The call is wrapped in `requestAnimationFrame`
//    and a short timeout because iOS finishes animating the keyboard
//    a tick after the focus event fires.
// 3. Use a touchstart handler (passive) to nudge the input to receive
//    focus immediately on tap, without the iOS 300ms double-tap delay
//    interfering with the keyboard's appearance.
// ════════════════════════════════════════════════════════════════════════════

import type { FocusEventHandler, TouchEventHandler } from 'react'

/** Class applied globally so every form input gets sane scroll behaviour. */
export const FOCUS_SCROLL_CLASS = 'cashiea-focus-scroll'

/** Inject the global CSS once. Idempotent — safe to call from many places. */
export function ensureInputFocusStyles(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById('cashiea-focus-styles')) return
  const style = document.createElement('style')
  style.id = 'cashiea-focus-styles'
  // scroll-margin-bottom keeps space between the input and the keyboard
  // so the caret never sits underneath the key caps. 120px is comfortably
  // larger than the iOS "done"/"return" bar.
  style.textContent = `
    .${FOCUS_SCROLL_CLASS}:focus,
    .${FOCUS_SCROLL_CLASS}:focus-visible {
      scroll-margin-top: 80px;
      scroll-margin-bottom: 120px;
    }
    @supports (height: 100dvh) {
      /* On mobile, the form column must be allowed to scroll all the way
         to the top — no clipping — so the focused input is always reachable. */
      .cashiea-form-scroll {
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
      }
    }
  `
  document.head.appendChild(style)
}

export interface UseInputFocusOptions {
  /** Border colour when focused. Defaults to the project's accent blue. */
  focusBorderColor?: string
  /** Box-shadow value when focused. */
  focusShadow?: string
  /** Border colour when blurred. */
  blurBorderColor?: string
  /** Whether to auto-scroll the input into view on focus. Default true. */
  autoScroll?: boolean
}

/**
 * Returns the props you should spread on an <input> (or via a wrapper) to
 * get the mobile-keyboard-friendly focus behaviour described above.
 *
 * @example
 *   const focusProps = useInputFocus({ focusBorderColor: C.blue, focusShadow: `0 0 0 3px ${C.blue}15` })
 *   <input {...focusProps} className={`${FOCUS_SCROLL_CLASS} w-full ...`} />
 */
export function useInputFocus(options: UseInputFocusOptions = {}) {
  ensureInputFocusStyles()

  const {
    focusBorderColor = 'rgb(var(--accent))',
    focusShadow = '0 0 0 3px rgb(var(--accent) / 0.15)',
    blurBorderColor = 'rgb(var(--line))',
    autoScroll = true,
  } = options

  const onFocus: FocusEventHandler<HTMLInputElement> = (e) => {
    const el = e.currentTarget
    el.style.borderColor = focusBorderColor
    el.style.boxShadow = focusShadow

    if (!autoScroll) return

    // Wait for iOS to start opening the keyboard, then centre the input.
    // rAF alone isn't enough — the keyboard animation lasts ~250ms and
    // changes the visual viewport mid-animation. Two staggered frames do
    // the job reliably across iOS Safari and Android Chrome.
    if (typeof window === 'undefined') return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        } catch {
          /* scrollIntoView can throw in detached iframes — ignore. */
        }
      })
    })
  }

  const onBlur: FocusEventHandler<HTMLInputElement> = (e) => {
    e.currentTarget.style.borderColor = blurBorderColor
    e.currentTarget.style.boxShadow = 'none'
  }

  // Touch handler: iOS sometimes ignores the synthetic focus from a tap
  // if the input is inside a scroll container. Calling .focus() directly
  // forces the keyboard up without the 300ms delay.
  const onTouchStart: TouchEventHandler<HTMLInputElement> = (e) => {
    // Don't preventDefault — we still want the click to land for any
    // parent handlers. Just ensure focus is queued before the keyboard
    // animation kicks off.
    const el = e.currentTarget
    if (document.activeElement !== el) {
      // setTimeout 0 defers until after the current event loop tick,
      // which is when iOS has registered the tap.
      setTimeout(() => el.focus(), 0)
    }
  }

  return { onFocus, onBlur, onTouchStart }
}
