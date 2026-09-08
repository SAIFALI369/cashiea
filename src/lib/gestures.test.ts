import { describe, it, expect, afterEach } from 'vitest'
import {
  classifyDrag,
  commitSwipe,
  drawerShouldDismiss,
  rubberBand,
  shouldIgnore,
  EDGE_SWIPE_ZONE,
  DRAG_SLOP,
} from './gestures'

// The gesture rules are the difference between an app that feels native
// and one that fights the user's thumb. They live in one module so they
// can be pinned by tests instead of by feel.

const base = {
  originX: 200,
  dx: -40,
  dy: 0,
  isPrimary: true,
  canBack: false,
  hasNeighbor: true,
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('classifyDrag — what a touch means', () => {
  it('gives vertical scrolling the win', () => {
    expect(classifyDrag({ ...base, dx: -40, dy: -60 })).toBe('none')
    expect(classifyDrag({ ...base, dx: -40, dy: 60 })).toBe('none')
  })

  it('waits for a decisive horizontal move before committing', () => {
    expect(classifyDrag({ ...base, dx: -(DRAG_SLOP - 1) })).toBe('none')
    expect(classifyDrag({ ...base, dx: -DRAG_SLOP })).toBe('lateral')
  })

  it('swipes between primary tabs off the edge', () => {
    expect(classifyDrag(base)).toBe('lateral')
  })

  it('rubber-bands at the end of the tab ring', () => {
    expect(classifyDrag({ ...base, hasNeighbor: false })).toBe('rubber')
  })

  it('never drags pages that are not primary tabs', () => {
    expect(classifyDrag({ ...base, isPrimary: false })).toBe('none')
  })

  it('turns a right drag from the left edge into swipe-back on deeper pages', () => {
    expect(
      classifyDrag({ ...base, originX: 10, dx: 40, isPrimary: false, canBack: true })
    ).toBe('back')
  })

  it('leaves the edge to the drawer on primary tabs', () => {
    expect(classifyDrag({ ...base, originX: 10, dx: 40, canBack: false })).toBe('none')
  })

  it('never reads a leftward edge swipe as back', () => {
    expect(
      classifyDrag({ ...base, originX: 10, dx: -40, canBack: true, isPrimary: false })
    ).toBe('none')
  })

  it('keeps the edge zone at a thumb-friendly width', () => {
    expect(EDGE_SWIPE_ZONE).toBeGreaterThanOrEqual(24)
    expect(EDGE_SWIPE_ZONE).toBeLessThanOrEqual(44)
  })
})

describe('rubberBand — resistance past the end', () => {
  it('damps travel and keeps the direction', () => {
    expect(rubberBand(100)).toBeLessThan(100)
    expect(rubberBand(-100)).toBeGreaterThan(-100)
    expect(Math.sign(rubberBand(-100))).toBe(-1)
  })

  it('stops growing at the cap', () => {
    expect(rubberBand(1000)).toBe(rubberBand(500))
  })
})

describe('commitSwipe — release thresholds', () => {
  const width = 390

  it('commits past 30% of the screen', () => {
    expect(commitSwipe({ travelled: -140, velocity: 0, width, direction: -1 })).toBe(true)
    expect(commitSwipe({ travelled: -100, velocity: 0, width, direction: -1 })).toBe(false)
  })

  it('commits on a fast fling in the right direction', () => {
    expect(commitSwipe({ travelled: -20, velocity: -900, width, direction: -1 })).toBe(true)
  })

  it('ignores a fling in the wrong direction', () => {
    expect(commitSwipe({ travelled: -20, velocity: 900, width, direction: -1 })).toBe(false)
  })

  it('commits swipe-back on a rightward fling', () => {
    expect(commitSwipe({ travelled: 30, velocity: 800, width, direction: 1 })).toBe(true)
    expect(commitSwipe({ travelled: 30, velocity: -800, width, direction: 1 })).toBe(false)
  })
})

describe('drawerShouldDismiss', () => {
  it('dismisses on a decisive leftward drag', () => {
    expect(drawerShouldDismiss(-120, 0)).toBe(true)
    expect(drawerShouldDismiss(-40, -900)).toBe(true)
    expect(drawerShouldDismiss(-20, 0)).toBe(false)
    expect(drawerShouldDismiss(60, 0)).toBe(false)
  })
})

describe('shouldIgnore — touches that belong to someone else', () => {
  const mount = (html: string) => {
    document.body.innerHTML = html
    return document.body.firstElementChild as HTMLElement
  }

  it('ignores dialogs, overlays, inputs and the nav', () => {
    expect(shouldIgnore(mount('<div role="dialog"><span>x</span></div>'))).toBe(true)
    expect(shouldIgnore(mount('<div class="fixed inset-0"><span>x</span></div>'))).toBe(true)
    expect(shouldIgnore(mount('<div><input id="q" /></div>').querySelector('#q'))).toBe(true)
    expect(shouldIgnore(mount('<div><textarea id="t"></textarea></div>').querySelector('#t'))).toBe(true)
    expect(shouldIgnore(mount('<nav aria-label="Primary"><button>x</button></nav>'))).toBe(true)
    expect(shouldIgnore(mount('<aside><button>x</button></aside>'))).toBe(true)
  })

  it('honours an explicit opt-out', () => {
    expect(shouldIgnore(mount('<div data-no-swipe-nav><span>x</span></div>'))).toBe(true)
  })

  it('ignores a touch with no element', () => {
    expect(shouldIgnore(null)).toBe(true)
  })

  it('accepts ordinary page content', () => {
    expect(shouldIgnore(mount('<div class="card"><p>Today</p></div>'))).toBe(false)
  })
})
