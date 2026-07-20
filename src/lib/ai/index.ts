// ════════════════════════════════════════════════════════════════
// AI Automation Client — talks to the Supabase Edge Function
// All API keys stay server-side (in the edge function). The client
// never sees or sends provider API keys.
// ════════════════════════════════════════════════════════════════

import { supabase, AI_FUNCTION_URL } from '../supabase'

export type TaskType = 'invoice' | 'report' | 'extract' | 'summary' | 'email' | 'sentiment'
export type AIProvider = 'openai' | 'gemini' | 'anthropic' | 'vercel_gateway' | 'openrouter'

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
 * Ask the AI Assistant a natural-language business question.
 * Uses the /functions/v1/ai-assistant edge function.
 */
export async function askAssistant(message: string, briefing = false): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('You must be logged in.')

  const res = await fetchWithRetry(AI_FUNCTION_URL.replace('ai-automation', 'ai-assistant'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ message, briefing }),
  })
  const data = await res.json().catch(() => ({ error: 'Invalid response from server' }))
  if (!res.ok) throw new Error(data?.error || `Request failed (HTTP ${res.status})`)
  return data.reply as string
}

/**
 * Call the Business Brain edge function (learn / predict / correct).
 */
export async function callBrain(mode: 'learn' | 'predict' | 'correct', extra: Record<string, unknown> = {}): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('You must be logged in.')

  const res = await fetchWithRetry(AI_FUNCTION_URL.replace('ai-automation', 'business-brain'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ mode, ...extra }),
  })
  const data = await res.json().catch(() => ({ error: 'Invalid response from server' }))
  if (!res.ok) throw new Error(data?.error || `Brain request failed (HTTP ${res.status})`)
  return data
}

/**
 * Kick off the Google OAuth flow — opens Google's consent screen.
 * Returns the authorize URL to redirect to, or null if OAuth isn't configured.
 */
export function googleAuthorizeUrl(userId: string, provider: 'gmail' | 'google_sheets'): string {
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')
  const fn = `${base}/google-oauth`
  return `${fn}?action=authorize&user=${encodeURIComponent(userId)}&provider=${provider}`
}

/**
 * Trigger a live sync from a connected Google source (calls google-fetch).
 */
export async function syncGoogleSource(provider: 'gmail' | 'google_sheets', spreadsheetId?: string): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()
  const { data: { user } } = await supabase.auth.getUser()
  if (!session || !user) throw new Error('You must be logged in.')
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')
  const res = await fetchWithRetry(`${base}/google-fetch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ user_id: user.id, provider, spreadsheet_id: spreadsheetId }),
  })
  const data = await res.json().catch(() => ({ error: 'Invalid response' }))
  if (!res.ok) throw new Error(data?.error || `Sync failed (HTTP ${res.status})`)
  return data
}

/**
 * Run a one-click Quick Task (low-stock alert, daily closing, Hindi bot,
 * GST invoice by voice, custom). Returns the AI-generated result + meta.
 */
export type QuickTaskMode = 'low_stock_alert' | 'daily_closing' | 'hindi_bot' | 'gst_invoice_voice' | 'custom'

export async function runQuickTask(mode: QuickTaskMode, text?: string, extra?: Record<string, unknown>): Promise<{ result: string; mode: string; meta: any }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('You must be logged in.')

  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')
  const res = await fetchWithRetry(`${base}/quick-tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ mode, text, ...extra }),
  })
  const data = await res.json().catch(() => ({ error: 'Invalid response' }))
  if (!res.ok) throw new Error(data?.error || `Quick task failed (HTTP ${res.status})`)
  return data
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

  // Strategy 2: find the outermost JSON container via brace matching.
  // Pick object ({}) vs array ([]) by whichever delimiter appears FIRST in
  // the text — that's the outermost structure. (Otherwise a `[{"a":1}]` would
  // wrongly match the inner `{`.) Tolerates braces inside strings.
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

  const firstBrace = text.indexOf('{')
  const firstBracket = text.indexOf('[')

  // Determine outermost type by first appearance, then try the other as fallback
  const ordered: ('object' | 'array')[] = []
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    ordered.push('object', 'array')
  } else {
    ordered.push('array', 'object')
  }

  for (const kind of ordered) {
    const match = kind === 'object' ? extractBalanced('{', '}') : extractBalanced('[', ']')
    if (match) {
      try {
        return JSON.parse(match) as T
      } catch {
        /* try next */
      }
    }
  }

  // Strategy 3: last resort — try the whole thing trimmed of prose lines
  try {
    return JSON.parse(text.trim()) as T
  } catch {
    return null
  }
}
