/**
 * errorTracking tests.
 *
 * The supabase module is mocked so flushes are deterministic (no network).
 * Reports flow: captureError → dedupe (sessionStorage) → rate limit
 * (sessionStorage) → queue → batch insert into client_errors.
 *
 * errorTracking keeps module-level state (queue, flush timer, init flag),
 * so each test gets a FRESH module via vi.resetModules() + dynamic import —
 * no cross-test contamination, and the 5 s flush timer is faked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null })

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({ insert: insertMock }),
    auth: {
      // No session in tests → reports flush as anonymous (user_id null),
      // matching the anon RLS policy.
      getSession: () => Promise.resolve({ data: { session: null } }),
      getUser: () => Promise.resolve({ data: { user: null } }),
    },
  },
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
}))

const FLUSH_MS = 5_000

async function freshModule() {
  vi.resetModules()
  return import('./errorTracking')
}

async function drainQueue(): Promise<void> {
  // Fire the pending flush timer (and any re-armed one) while letting the
  // async flush() promise chain settle at each step.
  for (let i = 0; i < 3; i += 1) {
    await vi.advanceTimersByTimeAsync(FLUSH_MS)
  }
}

function insertedRows(): any[] {
  const rows: any[] = []
  for (const call of insertMock.mock.calls) {
    const arg = call[0]
    if (Array.isArray(arg)) rows.push(...arg)
    else rows.push(arg)
  }
  return rows
}

beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear()
  insertMock.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('errorTracking', () => {
  it('captures an error and flushes a structured report to client_errors', async () => {
    const { captureError } = await freshModule()
    captureError(new Error('boom'), 'app', { source: 'test' })
    await drainQueue()

    expect(insertMock).toHaveBeenCalledTimes(1)
    const [row] = insertedRows()
    expect(row.error_type).toBe('app')
    expect(row.message).toBe('boom')
    expect(row.page_path).toMatch(/^\//)
    expect(row.user_id).toBeNull() // no session in tests
    expect(typeof row.session_id).toBe('string')
    expect(row.session_id.length).toBeGreaterThanOrEqual(4)
    expect(row.request_id).toMatch(/^[a-z0-9]{4,10}$/i)
    expect(row.meta).toEqual({ source: 'test' })
    expect(row.stack).toContain('boom')
  })

  it('dedupes identical error signatures within a session', async () => {
    const { captureError } = await freshModule()
    // The real-world case: a stuck component re-throwing the same failure
    // from the same call site on every render. The signature is
    // kind + message + first stack frames, so the SAME call site dedupes
    // while different call sites stay distinct. The loop keeps every
    // capture on one source line (one stack signature).
    const sameSite = () => new Error('same failure')
    for (let i = 0; i < 3; i += 1) captureError(sameSite(), 'app')
    await drainQueue()

    // 3 identical captures from one call site → exactly 1 row.
    expect(insertedRows()).toHaveLength(1)
  })

  it('keeps the same message from DIFFERENT call sites distinct', async () => {
    const { captureError } = await freshModule()
    const siteA = () => new Error('flaky network')
    const siteB = () => new Error('flaky network')
    captureError(siteA(), 'rejection')
    captureError(siteB(), 'rejection')
    await drainQueue()
    expect(insertedRows()).toHaveLength(2)
  })

  it('lets distinct errors through', async () => {
    const { captureError } = await freshModule()
    captureError(new Error('one'), 'app')
    captureError(new Error('two'), 'app')
    await drainQueue()
    expect(insertedRows()).toHaveLength(2)
  })

  it('rate-limits bursts: at most 6 reports per minute', async () => {
    const { captureError } = await freshModule()
    for (let i = 0; i < 10; i += 1) captureError(new Error(`distinct-${i}`), 'app')
    await drainQueue()
    expect(insertedRows().length).toBeLessThanOrEqual(6)
    expect(insertedRows().length).toBeGreaterThanOrEqual(5)
  })

  it('truncates oversized messages and stacks', async () => {
    const { captureError } = await freshModule()
    captureError(new Error('x'.repeat(10_000)), 'app')
    await drainQueue()
    const [row] = insertedRows()
    expect(row.message.length).toBeLessThanOrEqual(520)
    expect(row.message).toContain('truncated')
    expect((row.stack || '').length).toBeLessThanOrEqual(4_300)
  })

  it('handles non-Error rejections (strings) without crashing', async () => {
    const { captureError } = await freshModule()
    captureError('plain string failure', 'rejection')
    await drainQueue()
    const [row] = insertedRows()
    expect(row.message).toBe('plain string failure')
    expect(row.error_type).toBe('rejection')
  })

  it('initErrorTracking is idempotent', async () => {
    const { initErrorTracking } = await freshModule()
    expect(() => {
      initErrorTracking()
      initErrorTracking()
    }).not.toThrow()
  })

  it('captures resource-load failures through the window error hook', async () => {
    const { initErrorTracking } = await freshModule()
    initErrorTracking()
    const evt = new Event('error')
    Object.defineProperty(evt, 'target', {
      value: { tagName: 'IMG', src: 'https://cdn.example.com/missing.png' },
    })
    window.dispatchEvent(evt)
    await drainQueue()

    const rows = insertedRows()
    expect(rows.some((r: any) => r.message.includes('Resource failed to load'))).toBe(true)
    const row = rows.find((r: any) => r.message.includes('Resource failed to load'))
    expect(row.meta).toMatchObject({ resource: true, tag: 'IMG' })
  })
})
