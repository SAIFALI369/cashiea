import { describe, it, expect, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter } from 'react-router-dom'
import PageStack from './PageStack'

// Direct react-dom rendering (no testing-library in this repo):
// PageStack is exercised through a tiny harness that flips its pathname.
//
// These tests guard the ONE invariant of the transition engine — exactly
// one page in the DOM, its words present exactly once. That is the bug
// class that shipped before (outgoing + incoming pages painted over each
// other, and stale page nodes that never unmounted after rapid taps).

let container: HTMLDivElement | null = null
let root: Root | null = null

function renderHarness(pathname: string) {
  if (!container) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  }
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={['/app']}>
        <PageStack pathname={pathname}>
          <div>PAGE:: {pathname}</div>
        </PageStack>
      </MemoryRouter>
    )
  })
}

const settle = (ms = 900) => new Promise((r) => setTimeout(r, ms))

/** Every page node currently in the tree. */
const pageNodes = () => Array.from(container!.querySelectorAll('[data-butter-page]'))

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  container = null
  root = null
})

describe('PageStack — butter transitions', () => {
  it('renders the current page', () => {
    renderHarness('/app')
    expect(container!.textContent).toContain('/app')
  })

  it('shows the new page immediately — never a blank beat', () => {
    renderHarness('/app')
    renderHarness('/app/pos')
    // Synchronously after the swap the incoming page is already in the
    // tree, so the screen is never empty between pages.
    expect(container!.textContent).toContain('/app/pos')
  })

  it('keeps exactly ONE page mounted, with its words exactly once', async () => {
    renderHarness('/app')
    await settle(120)
    renderHarness('/app/invoices')
    await settle()

    expect(pageNodes()).toHaveLength(1)
    expect(pageNodes()[0].getAttribute('data-butter-page')).toBe('/app/invoices')
    // Doubled text is the regression this file exists for.
    expect(container!.textContent).toBe('PAGE:: /app/invoices')
  })

  it('never stacks pages when two navigations land back-to-back', async () => {
    renderHarness('/app')
    await settle(120)
    renderHarness('/app/invoices')
    renderHarness('/app/reports') // tapped ~immediately after
    await settle()

    expect(pageNodes()).toHaveLength(1)
    expect(pageNodes()[0].getAttribute('data-butter-page')).toBe('/app/reports')
    expect(container!.textContent).toBe('PAGE:: /app/reports')
  })

  it('stays single-page across a long browsing session', async () => {
    const route = ['/app', '/app/pos', '/app/customers', '/app/reports', '/app/settings', '/app']
    for (const p of route) {
      renderHarness(p)
      await settle(140)
      expect(pageNodes()).toHaveLength(1)
    }
    await settle()
    expect(pageNodes()).toHaveLength(1)
    expect(container!.textContent).toBe('PAGE:: /app')
  })

  it('never leaves the live layer hidden after a navigation', async () => {
    renderHarness('/app')
    await settle(120)
    renderHarness('/app/pos')
    await settle()
    const live = container!.querySelector('[data-butter-page]')!.parentElement as HTMLElement
    expect(live.style.visibility).not.toBe('hidden')
    expect(live.style.transform === '' || live.style.transform === 'none').toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════
// Gesture integration — real pointer events through a real router.
// jsdom runs no CSS transitions, so the commit lands on the safety
// timer inside PageStack (the same path a throttled phone tab takes).
// ════════════════════════════════════════════════════════════════

import { Routes, Route, useLocation } from 'react-router-dom'

function Harness() {
  const location = useLocation()
  return (
    <PageStack pathname={location.pathname}>
      <div>PAGE:: {location.pathname}</div>
    </PageStack>
  )
}

function renderApp(entries: string[]) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root!.render(
      <MemoryRouter initialEntries={entries}>
        <Routes>
          <Route path="*" element={<Harness />} />
        </Routes>
      </MemoryRouter>
    )
  })
}

const pointer = (type: string, clientX: number, clientY = 300) => {
  const e = new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true })
  Object.defineProperty(e, 'pointerType', { value: 'touch' })
  Object.defineProperty(e, 'pointerId', { value: 1 })
  return e
}

const liveLayer = () =>
  container!.querySelector('[data-butter-page]')!.parentElement as HTMLElement

describe('PageStack — gestures', () => {
  it('a committed tab swipe survives the pointer-capture drop', async () => {
    renderApp(['/app'])
    await settle(60)
    const live = liveLayer()

    act(() => {
      live.dispatchEvent(pointer('pointerdown', 900))
      live.dispatchEvent(pointer('pointermove', 400))
      live.dispatchEvent(pointer('pointerup', 400))
    })
    // Committed: the page is sliding out to the neighbour tab.
    expect(live.style.transform).toContain('translate3d')
    const committed = live.style.transform

    // `lostpointercapture` ALWAYS follows pointerup. A cancel handler
    // that still thought a gesture was live used to spring the page
    // back here, undoing the commit mid-flight.
    act(() => {
      live.dispatchEvent(new Event('lostpointercapture', { bubbles: true }))
    })
    expect(live.style.transform).toBe(committed)

    await settle(600)
    expect(pageNodes()).toHaveLength(1)
    expect(container!.textContent).toBe('PAGE:: /app/pos')
    expect(liveLayer().style.visibility).not.toBe('hidden')
  })

  it('edge swipe-back returns to the previous page', async () => {
    renderApp(['/app', '/app/reports'])
    await settle(60)

    const live = liveLayer()
    act(() => {
      live.dispatchEvent(pointer('pointerdown', 8)) // inside the reserved edge
      live.dispatchEvent(pointer('pointermove', 700))
      live.dispatchEvent(pointer('pointerup', 700))
    })
    await settle(600)

    expect(pageNodes()).toHaveLength(1)
    expect(container!.textContent).toBe('PAGE:: /app')
  })

  it('a vertical scroll never turns into a swipe', async () => {
    renderApp(['/app'])
    await settle(60)
    const live = liveLayer()
    act(() => {
      live.dispatchEvent(pointer('pointerdown', 500, 100))
      live.dispatchEvent(pointer('pointermove', 505, 500))
      live.dispatchEvent(pointer('pointerup', 505, 500))
    })
    await settle(400)
    expect(container!.textContent).toBe('PAGE:: /app')
  })

  it('a tap does not navigate and does not lock the shell', async () => {
    renderApp(['/app'])
    await settle(60)
    const live = liveLayer()
    act(() => {
      live.dispatchEvent(pointer('pointerdown', 500))
      live.dispatchEvent(pointer('pointerup', 502))
    })
    await settle(120)
    expect(container!.textContent).toBe('PAGE:: /app')
    expect(live.style.visibility).not.toBe('hidden')

    // Immediately swipeable again — no busy-window swallowing the next tap.
    act(() => {
      live.dispatchEvent(pointer('pointerdown', 900))
      live.dispatchEvent(pointer('pointermove', 400))
      live.dispatchEvent(pointer('pointerup', 400))
    })
    await settle(600)
    expect(container!.textContent).toBe('PAGE:: /app/pos')
  })
})
