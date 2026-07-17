// ════════════════════════════════════════════════════════════════
// AI Automation Client — talks to the Supabase Edge Function
// All API keys stay server-side (in the edge function). The client
// never sees or sends provider API keys.
// ════════════════════════════════════════════════════════════════

import { supabase, AI_FUNCTION_URL } from '../supabase'

export type TaskType = 'invoice' | 'report' | 'extract' | 'summary' | 'email' | 'sentiment'
export type AIProvider = 'openai' | 'gemini' | 'anthropic'

export interface AICallParams {
  task_type: TaskType
  prompt: string
  provider?: AIProvider
  /** Extra fields merged into the request body (e.g. report_type, title). */
  extra?: Record<string, unknown>
}

export interface AICallResult {
  result: string
  provider: AIProvider
  task_type: TaskType
}

/**
 * Fetch with retry + exponential backoff.
 * Retries on network errors and 429/5xx responses (transient failures),
 * not on 4xx client errors.
 */
async function fetchWithRetry(
  input: string,
  init: RequestInit,
  retries = 3,
  baseDelay = 500
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init)
      // Retry on rate-limit or server errors
      if (res.status === 429 || res.status >= 500) {
        if (attempt === retries) return res // give back the last response
        const retryAfter = Number(res.headers.get('retry-after'))
        const delay = retryAfter ? retryAfter * 1000 : baseDelay * Math.pow(2, attempt)
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      return res
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === retries) throw lastError
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((r) => setTimeout(r, delay))
    }
  }
  throw lastError ?? new Error('Request failed after retries')
}

export async function callAI(params: AICallParams): Promise<AICallResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('You must be logged in to use AI features.')
  }

  const res = await fetchWithRetry(AI_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ task_type: params.task_type, prompt: params.prompt, provider: params.provider, ...params.extra }),
  })

  const data = await res.json().catch(() => ({ error: 'Invalid response from server' }))

  if (!res.ok) {
    const message = data?.error || `AI request failed (HTTP ${res.status})`
    const err = new Error(message) as Error & { status?: number }
    err.status = res.status
    throw err
  }

  return data as AICallResult
}

/**
 * Robustly extract JSON from an AI response. AI models frequently:
 *  - wrap output in ```json fences
 *  - add preamble ("Here is the invoice:") before/after the JSON
 *  - include trailing prose
 * This tries multiple strategies before giving up.
 */
export function parseAIJson<T = unknown>(text: string): T | null {
  if (!text || typeof text !== 'string') return null

  // Strategy 1: strip markdown fences, try direct parse
  const cleaned = text
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
    .replace(/\s*```[\s\S]*$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    /* try next strategy */
  }

  // Strategy 2: find the outermost JSON object or array via brace matching.
  // Scans for the first '{' or '[', then balances to its closing bracket,
  // tolerating braces inside strings.
  const extractBalanced = (open: string, close: string): string | null => {
    const start = text.indexOf(open)
    if (start === -1) return null
    let depth = 0
    let inString = false
    let escaped = false
    for (let i = start; i < text.length; i++) {
      const ch = text[i]
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') {
        inString = !inString
        continue
      }
      if (inString) continue
      if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) return text.slice(start, i + 1)
      }
    }
    return null
  }

  const objMatch = extractBalanced('{', '}')
  if (objMatch) {
    try {
      return JSON.parse(objMatch) as T
    } catch {
      /* fall through */
    }
  }

  const arrMatch = extractBalanced('[', ']')
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch) as T
    } catch {
      /* fall through */
    }
  }

  // Strategy 3: last resort — try the whole thing trimmed of prose lines
  try {
    return JSON.parse(text.trim()) as T
  } catch {
    return null
  }
}
