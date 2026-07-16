// ════════════════════════════════════════════════════════════════
// AI Automation Client — talks to the Supabase Edge Function
// All API keys stay server-side (in the edge function). The client
// never sees or sends provider API keys.
// ════════════════════════════════════════════════════════════════

import { supabase, AI_FUNCTION_URL } from '../supabase'

export type TaskType = 'invoice' | 'report' | 'extract' | 'summary'
export type AIProvider = 'openai' | 'gemini' | 'anthropic'

export interface AICallParams {
  task_type: TaskType
  prompt: string
  provider?: AIProvider
}

export interface AICallResult {
  result: string
  provider: AIProvider
  task_type: TaskType
}

export async function callAI(params: AICallParams): Promise<AICallResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    throw new Error('You must be logged in to use AI features.')
  }

  const res = await fetch(AI_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(params),
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.error || 'AI request failed')
  }

  return data as AICallResult
}

// ─── Helper: safe JSON parse (AI may wrap in markdown) ──────────
export function parseAIJson<T = unknown>(text: string): T | null {
  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}
