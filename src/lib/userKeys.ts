// ════════════════════════════════════════════════════════════════
// User AI Keys — frontend client for the set-user-api-key edge
// function and the get_user_api_key_status() RPC.
//
// Supports any provider the user wants: OpenAI, Anthropic,
// Google Gemini, OpenRouter, DeepSeek, Meta (via OpenRouter),
// Mistral, Groq, xAI (Grok), Cohere, Perplexity, or any
// OpenAI-compatible endpoint (Together, Anyscale, self-hosted
// llama.cpp / vLLM / ollama, etc.) via the "custom" provider.
//
// The plaintext key is sent to the backend over HTTPS, encrypted
// server-side with pgcrypto, and never returned to the client
// (only the last-4 hint + the provider + the model name).
// ════════════════════════════════════════════════════════════════

import { supabase } from './supabase'

const SET_KEY_URL = `${(import.meta.env.VITE_SUPABASE_URL || '').replace('.supabase.co', '.functions.supabase.co')}/set-user-api-key`

export type AIProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'meta'
  | 'mistral'
  | 'groq'
  | 'xai'
  | 'cohere'
  | 'perplexity'
  | 'custom'

export interface UserAPIKeyStatus {
  has_key: boolean
  provider: AIProviderId | string | null
  hint: string | null
  model: string | null
  baseUrl?: string | null
}

// Curated list of providers, used by the Settings UI. Keep this
// in sync with PROVIDERS in supabase/functions/_shared/ai.ts.
export const PROVIDER_OPTIONS: { id: AIProviderId; label: string; keyPrefix: string; signupUrl: string; defaultModel: string; requiresBaseUrl?: boolean }[] = [
  { id: 'openrouter',  label: 'OpenRouter (recommended)', keyPrefix: 'sk-or-v1-', signupUrl: 'https://openrouter.ai/keys',     defaultModel: 'google/gemini-2.5-flash-lite' },
  { id: 'openai',      label: 'OpenAI',                   keyPrefix: 'sk-',         signupUrl: 'https://platform.openai.com/api-keys', defaultModel: 'gpt-4o-mini' },
  { id: 'anthropic',   label: 'Anthropic (Claude)',       keyPrefix: 'sk-ant-',     signupUrl: 'https://console.anthropic.com/settings/keys', defaultModel: 'claude-3-5-sonnet-20241022' },
  { id: 'gemini',      label: 'Google Gemini',            keyPrefix: 'AIza',        signupUrl: 'https://aistudio.google.com/apikey', defaultModel: 'gemini-2.5-flash-lite' },
  { id: 'deepseek',    label: 'DeepSeek',                 keyPrefix: 'sk-',         signupUrl: 'https://platform.deepseek.com/api_keys', defaultModel: 'deepseek-chat' },
  { id: 'meta',        label: 'Meta Llama (via OpenRouter)', keyPrefix: 'sk-or-v1-', signupUrl: 'https://openrouter.ai/keys',     defaultModel: 'meta-llama/llama-3.3-70b-instruct' },
  { id: 'mistral',     label: 'Mistral AI',               keyPrefix: 'sk-',         signupUrl: 'https://console.mistral.ai/api-keys', defaultModel: 'mistral-large-latest' },
  { id: 'groq',        label: 'Groq (fast inference)',    keyPrefix: 'gsk_',        signupUrl: 'https://console.groq.com/keys',   defaultModel: 'llama-3.3-70b-versatile' },
  { id: 'xai',         label: 'xAI (Grok)',               keyPrefix: 'xai-',        signupUrl: 'https://console.x.ai',           defaultModel: 'grok-2-latest' },
  { id: 'cohere',      label: 'Cohere',                   keyPrefix: 'co-',         signupUrl: 'https://dashboard.cohere.com/api-keys', defaultModel: 'command-r-plus' },
  { id: 'perplexity',  label: 'Perplexity',               keyPrefix: 'pplx-',       signupUrl: 'https://www.perplexity.ai/settings/api', defaultModel: 'llama-3.1-sonar-large-128k-online' },
  { id: 'custom',      label: 'Custom (OpenAI-compatible)', keyPrefix: '',          signupUrl: '',                                defaultModel: 'default', requiresBaseUrl: true },
]

// Auto-detect the provider from the key shape. Used by Settings
// to pre-select the provider when the user pastes a key.
export function detectProviderFromKey(key: string): AIProviderId {
  const k = (key || '').trim()
  if (k.startsWith('sk-or-v1-')) return 'openrouter'
  if (k.startsWith('sk-ant-'))  return 'anthropic'
  if (k.startsWith('AIza'))     return 'gemini'
  if (k.startsWith('gsk_'))     return 'groq'
  if (k.startsWith('xai-'))     return 'xai'
  if (k.startsWith('pplx-'))    return 'perplexity'
  if (k.startsWith('co-'))      return 'cohere'
  if (k.startsWith('sk-'))      return 'openai' // most common default
  return 'openai'
}

/** Read the user's current key status. Returns { has_key: false } if not set. */
export async function getUserAPIKeyStatus(): Promise<UserAPIKeyStatus> {
  const { data, error } = await supabase.rpc('get_user_api_key_status')
  if (error) return { has_key: false, provider: null, hint: null, model: null }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { has_key: false, provider: null, hint: null, model: null }
  return {
    has_key: !!row.has_key,
    provider: row.provider ?? null,
    hint: row.hint ?? null,
    model: row.model ?? null,
  }
}

/**
 * Save / replace the user's AI key + chosen default model.
 * Triggers the set-user-api-key edge function.
 */
export async function setUserAPIKey(
  apiKey: string,
  provider: AIProviderId | string,
  defaultModel: string,
  baseUrl?: string,
  label?: string
): Promise<{ provider: string; hint: string; model: string; baseUrl?: string | null }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('You must be logged in.')

  const res = await fetch(SET_KEY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      provider,
      api_key: apiKey,
      default_model: defaultModel,
      base_url: baseUrl || undefined,
      label: label || undefined,
    }),
  })
  const data = await res.json().catch(() => ({ error: 'Invalid response' }))
  if (!res.ok) throw new Error(data?.error || `Failed to save key (HTTP ${res.status})`)
  return { provider: data.provider, hint: data.hint, model: data.model, baseUrl: data.baseUrl }
}

/** Remove the user's stored key. */
export async function deleteUserAPIKey(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not logged in')
  const { error } = await supabase.from('user_api_keys').delete().eq('user_id', user.id)
  if (error) throw error
}
