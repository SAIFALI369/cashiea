import { describe, it, expect } from 'vitest'

// Mirror the fallback-eligibility logic from openrouter.ts so we can
// unit-test it without needing Deno. The actual edge function uses the
// same FALLBACK_CODES set + ordering.
const FALLBACK_CODES = new Set([402, 429, 403, 408, 409, 413, 500, 502, 503, 504, 529])

const OPENROUTER_MODELS = [
  'google/gemini-2.5-flash-lite',
  'moonshotai/kimi-k3',
  'meta-llama/llama-4-maverick',
  'google/gemini-2.5-flash',
  'tencent/hy3:free',
  'google/gemma-4-26b-a4b-it:free',
]

// Pure simulation of the callOpenRouter fallback loop, given a map of
// model -> {status}. Returns the list of models tried + which succeeded.
function simulateChain(results: Record<string, { ok: boolean; status: number }>): { tried: string[]; succeeded: string | null } {
  const tried: string[] = []
  for (const model of OPENROUTER_MODELS) {
    tried.push(model)
    const r = results[model]
    if (!r) continue // missing = skip
    if (r.ok) return { tried, succeeded: model }
    // Non-fallback error → stop immediately (matches the edge function)
    if (!FALLBACK_CODES.has(r.status)) return { tried, succeeded: null }
  }
  return { tried, succeeded: null }
}

describe('OpenRouter fallback chain', () => {
  it('uses Gemini first when it succeeds', () => {
    const r = simulateChain({ 'google/gemini-2.5-flash-lite': { ok: true, status: 200 } })
    expect(r.succeeded).toBe('google/gemini-2.5-flash-lite')
    expect(r.tried).toHaveLength(1)
  })

  it('falls to Kimi K3 when Gemini is out of credits (402)', () => {
    const r = simulateChain({
      'google/gemini-2.5-flash-lite': { ok: false, status: 402 },
      'moonshotai/kimi-k3': { ok: true, status: 200 },
    })
    expect(r.succeeded).toBe('moonshotai/kimi-k3')
    expect(r.tried).toHaveLength(2)
  })

  it('falls to Llama when Gemini + Kimi both rate-limited (429)', () => {
    const r = simulateChain({
      'google/gemini-2.5-flash-lite': { ok: false, status: 429 },
      'moonshotai/kimi-k3': { ok: false, status: 429 },
      'meta-llama/llama-4-maverick': { ok: true, status: 200 },
    })
    expect(r.succeeded).toBe('meta-llama/llama-4-maverick')
    expect(r.tried).toHaveLength(3)
  })

  it('falls all the way to a free model when paid ones need credits', () => {
    const r = simulateChain({
      'google/gemini-2.5-flash-lite': { ok: false, status: 402 },
      'moonshotai/kimi-k3': { ok: false, status: 402 },
      'meta-llama/llama-4-maverick': { ok: false, status: 402 },
      'google/gemini-2.5-flash': { ok: false, status: 402 },
      'tencent/hy3:free': { ok: true, status: 200 },
    })
    expect(r.succeeded).toBe('tencent/hy3:free')
    expect(r.tried).toHaveLength(5)
  })

  it('stops immediately on a 400 bad-request (non-fallback)', () => {
    const r = simulateChain({
      'google/gemini-2.5-flash-lite': { ok: false, status: 400 },
    })
    expect(r.succeeded).toBeNull()
    expect(r.tried).toHaveLength(1)
  })

  it('returns null when every model fails', () => {
    const allFail: Record<string, { ok: boolean; status: number }> = {}
    OPENROUTER_MODELS.forEach((m) => { allFail[m] = { ok: false, status: 402 } })
    const r = simulateChain(allFail)
    expect(r.succeeded).toBeNull()
    expect(r.tried).toHaveLength(OPENROUTER_MODELS.length)
  })

  it('treats 503 (provider down) as fallback-eligible', () => {
    const r = simulateChain({
      'google/gemini-2.5-flash-lite': { ok: false, status: 503 },
      'moonshotai/kimi-k3': { ok: true, status: 200 },
    })
    expect(r.succeeded).toBe('moonshotai/kimi-k3')
  })

  it('treats 401 (invalid key) as non-fallback', () => {
    const r = simulateChain({
      'google/gemini-2.5-flash-lite': { ok: false, status: 401 },
    })
    expect(r.succeeded).toBeNull()
    expect(r.tried).toHaveLength(1) // doesn't waste calls on a bad key
  })

  it('the chain order matches the spec: Gemini → Kimi K3 → Llama', () => {
    expect(OPENROUTER_MODELS[0]).toBe('google/gemini-2.5-flash-lite')
    expect(OPENROUTER_MODELS[1]).toBe('moonshotai/kimi-k3')
    expect(OPENROUTER_MODELS[2]).toBe('meta-llama/llama-4-maverick')
  })
})
