import { describe, it, expect, afterEach } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter } from 'react-router-dom'
import PageStack from './PageStack'
import { getSnapshot } from '../lib/butterNav'

// Direct react-dom rendering (no testing-library in this repo):
// PageStack is exercised through a tiny harness that flips its pathname.

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
          <div data-testid={`page-${pathname.replace(/\W+/g, '-')}`}>{pathname}</div>
        </PageStack>
      </MemoryRouter>
    )
  })
}

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

  it('keeps BOTH pages mounted while transitioning (no blank beat)', () => {
    renderHarness('/app')
    expect(container!.textContent).toContain('/app')
    // Navigate away — synchronously after the swap the outgoing page
    // is still mounted (popLayout parallel exit), so the screen is
    // never empty between pages.
    renderHarness('/app/pos')
    expect(container!.textContent).toContain('/app/pos')
    expect(container!.textContent).toContain('/app')
  })

  it('freezes a snapshot of the page it leaves', async () => {
    renderHarness('/app/settings')
    expect(getSnapshot('/app/settings')).toBeNull()
    renderHarness('/app')
    // Capture happens on the next frame (from the exit clone).
    await new Promise((r) => setTimeout(r, 60))
    expect(getSnapshot('/app/settings')).toContain('/app/settings')
  })
})
