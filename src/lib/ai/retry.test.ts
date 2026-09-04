import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create a stable, controllable getSession mock that survives reset.
const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}))

vi.mock('../supabase', () => ({
  supabase: {
    auth: { getSession: getSessionMock },
  },
  AI_FUNCTION_URL: 'https://test.supabase.co/functions/v1/ai-automation',
}))

import type { AICallParams } from '../ai'
import { callAI } from '../ai'

const baseParams: AICallParams = { task_type: 'summary', prompt: 'hello' }

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'retry-after': '0' },
  })
}

describe('callAI retry behavior', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Default to an authenticated session
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    getSessionMock.mockReset()
  })

  it('succeeds on first try', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200, { result: 'ok', provider: 'openai', task_type: 'summary' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await callAI(baseParams)
    expect(result.result).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries on 429 then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, { error: 'rate limited' }))
      .mockResolvedValueOnce(makeResponse(200, { result: 'ok', provider: 'openai', task_type: 'summary' }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = callAI(baseParams)
    await vi.runAllTimersAsync()
    const result = await pending

    expect(result.result).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry on 500 (deterministic error — returns immediately)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(500, { error: 'server error' }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = callAI(baseParams)
    pending.catch(() => {}) // attach handler early to avoid unhandled rejection
    await vi.runAllTimersAsync()
    await expect(pending).rejects.toThrow(/AI request failed|server error|status 500/)
    // 500 is a deterministic server bug — retrying wastes tokens and time.
    // Only 429/503/504 are transient and retried.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT retry on a 400 client error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(400, { error: 'bad request' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(callAI(baseParams)).rejects.toThrow('bad request')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries on a thrown network error then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(makeResponse(200, { result: 'ok', provider: 'openai', task_type: 'summary' }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = callAI(baseParams)
    await vi.runAllTimersAsync()
    const result = await pending

    expect(result.result).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries on repeated network errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'))
    vi.stubGlobal('fetch', fetchMock)

    const pending = callAI(baseParams)
    pending.catch(() => {}) // attach handler early to avoid unhandled rejection
    await vi.runAllTimersAsync()
    await expect(pending).rejects.toThrow('network down')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('throws when there is no session (not logged in)', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(callAI(baseParams)).rejects.toThrow('logged in')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
