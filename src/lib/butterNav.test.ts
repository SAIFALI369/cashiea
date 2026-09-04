import { describe, it, expect } from 'vitest'
import {
  PRIMARY_PATHS,
  navDirection,
  lateralNeighbor,
  pageDepth,
  saveSnapshot,
  getSnapshot,
} from './butterNav'

describe('butterNav — page flow model', () => {
  it('keeps the primary ring in bottom-nav order', () => {
    expect(PRIMARY_PATHS).toEqual(['/app', '/app/pos', '/app/customers', '/app/assistant'])
  })

  it('marks primary-tab swaps as lateral with a direction sign', () => {
    expect(navDirection('/app', '/app/pos')).toEqual({ kind: 'lateral', sign: 1 })
    expect(navDirection('/app/customers', '/app')).toEqual({ kind: 'lateral', sign: -1 })
    expect(navDirection('/app/assistant', '/app/customers')).toEqual({ kind: 'lateral', sign: -1 })
  })

  it('treats going deeper as push and back up as pop', () => {
    expect(navDirection('/app/campaigns', '/app/campaigns/new').kind).toBe('push')
    expect(navDirection('/app', '/app/settings').kind).toBe('push')
    expect(navDirection('/app/campaigns/new', '/app/campaigns').kind).toBe('pop')
    expect(navDirection('/app/settings', '/app').kind).toBe('pop')
  })

  it('crossfades unrelated same-depth jumps', () => {
    expect(navDirection('/app/invoices', '/app/khata')).toEqual({ kind: 'fade', sign: 0 })
  })

  it('fades when nothing changes', () => {
    expect(navDirection('/app/pos', '/app/pos').kind).toBe('fade')
  })

  it('knows the depth of editor routes (dynamic ids)', () => {
    expect(pageDepth('/app')).toBe(0)
    expect(pageDepth('/app/pos')).toBe(0)
    expect(pageDepth('/app/reports')).toBe(1)
    expect(pageDepth('/app/campaigns/new')).toBe(2)
    expect(pageDepth('/app/campaigns/abc-123')).toBe(2)
  })

  it('finds the lateral neighbour for a drag direction', () => {
    // drag left (dx < 0) → next tab; drag right (dx > 0) → previous tab
    expect(lateralNeighbor('/app', -20)?.path).toBe('/app/pos')
    expect(lateralNeighbor('/app', 20)).toBeNull() // nothing before Today
    expect(lateralNeighbor('/app/customers', 20)?.path).toBe('/app/pos')
    expect(lateralNeighbor('/app/assistant', -20)).toBeNull() // nothing after Meraj
    expect(lateralNeighbor('/app/reports', -20)).toBeNull() // not a primary tab
  })
})

describe('butterNav — snapshot store', () => {
  it('stores and returns page snapshots', () => {
    saveSnapshot('/app/pos', '<div>POS</div>')
    expect(getSnapshot('/app/pos')).toBe('<div>POS</div>')
    expect(getSnapshot('/app')).toBeNull()
  })

  it('never stores empty or oversized html', () => {
    saveSnapshot('/app', '')
    saveSnapshot('/app/khata', 'x'.repeat(500_000))
    expect(getSnapshot('/app')).toBeNull()
    expect(getSnapshot('/app/khata')).toBeNull()
  })

  it('evicts the oldest entry beyond the LRU cap', () => {
    const paths = ['/a', '/b', '/c', '/d', '/e', '/f', '/g']
    paths.forEach((p, i) => {
      saveSnapshot(p, `<div>${i}</div>`)
      // nudge timestamps so eviction order is deterministic
      const s = (getSnapshot(p) !== null ? undefined : null)
      void s
    })
    expect(getSnapshot('/a')).toBeNull() // oldest evicted
    expect(getSnapshot('/g')).not.toBeNull()
  })
})
