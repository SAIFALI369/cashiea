import { useEffect, useRef } from 'react'
import { HOLD_START_DELAY_MS, holdRepeatDelay, holdStep } from './pos'

/**
 * useHoldRepeat — press-and-hold acceleration for quantity steppers.
 *
 * A short tap fires nothing (let the caller's onClick handle the +1);
 * holding past HOLD_START_DELAY_MS starts auto-repeat ticks that get
 * faster and bigger the longer the button is held, so a cashier can
 * reach qty 12 without twelve taps.
 *
 * Returns pointer handlers to spread onto the button. Ticks are
 * delivered with the accumulated step size, and the caller decides
 * how to clamp (e.g. stock limits).
 */
export function useHoldRepeat(onTick: (step: number) => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAt = useRef(0)
  const cb = useRef(onTick)
  cb.current = onTick

  const clear = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    startedAt.current = 0
  }

  // Safety: never leak a running timer after unmount.
  useEffect(() => clear, [])

  const schedule = (delay: number) => {
    timer.current = setTimeout(() => {
      const elapsed = Date.now() - startedAt.current
      cb.current(holdStep(elapsed))
      schedule(holdRepeatDelay(elapsed))
    }, delay)
  }

  const onPointerDown = () => {
    clear()
    startedAt.current = Date.now()
    schedule(HOLD_START_DELAY_MS)
  }

  return {
    onPointerDown,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  }
}
