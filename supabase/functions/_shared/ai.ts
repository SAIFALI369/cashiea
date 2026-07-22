// ════════════════════════════════════════════════════════════════
// AI PROVIDER DISPATCHER — shared by all AI edge functions.
//
// Supports 14 provider families. Each user picks one in Settings
// and pastes their own key. The edge functions dispatch to the
// right provider based on what's in user_api_keys.
//
// Resolution order for the API key:
//   1. The CALLING USER's own key, if they set one in Settings.
//      Stored encrypted in user_api_keys, decrypted here via the
//      get_user_api_key(p_user_id, USER_KEY_ENC_PASS) RPC.
//   2. The OPERATOR's global env var (legacy path):
//        OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY /
//        OPENROUTER_API_KEY / DEEPSEEK_API_KEY / ...
//   3. If neither exists, we throw a clear, actionable error that
//      tells the user exactly what to do (open Settings, paste a key).
//
// The plaintext key never leaves the backend — only the chosen
// model + the final response text come back to the caller.
// ════════════════════════════════════════════════════════════════

// ─── Provider metadata ────────────────────────────────────────
// Lists the base URL + default model + per-request extra headers
// for each provider family. Adding a new provider is a one-line
// change here + a dropdown entry in the Settings UI.
export interface ProviderConfig {
  id: string
  label: string
  baseUrl: string  // OpenAI-compatible endpoints use {base}/chat/completions
  defaultModel: string
  authStyle: 'bearer' | 'header' | 'query'
  // Per-request headers beyond Content-Type + Authorization
  extraHeaders?: (apiKey: string) => Record<string, string>
  // Some providers (Gemini) need a different request body shape
  // or a different response parser. By default we use the OpenAI
  // chat completions shape (works for most providers).
  formatRequest: (model: string, systemPrompt: string, prompt: string, opts: { maxTokens?: number; temperature?: number }) => unknown
  formatResponse: (data: any) => string
  // The URL path for the chat endpoint
  chatPath: string
  // Some APIs use ?key=... query auth (Gemini)
  useQueryAuth?: boolean
}

// ── OpenAI-compatible request/response formatters ───────────
function openaiFormatRequest(model: string, systemPrompt: string, prompt: string, opts: { maxTokens?: number; temperature?: number }) {
  return {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 1500,
  }
}
function openaiFormatResponse(data: any): string {
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('Provider returned no content in choices[0].message.content')
  return content as string
}

// ── Gemini: different request/response shape ────────────────
function geminiFormatRequest(model: string, systemPrompt: string, prompt: string, opts: { maxTokens?: number; temperature?: number }) {
  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.7, maxOutputTokens: opts.maxTokens ?? 1500 },
  }
}
function geminiFormatResponse(data: any): string {
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no content in candidates[0].content.parts[0].text')
  return text as string
}

// ── Anthropic: messages API ──────────────────────────────────
function anthropicFormatRequest(model: string, systemPrompt: string, prompt: string, opts: { maxTokens?: number; temperature?: number }) {
  return {
    model,
    max_tokens: opts.maxTokens ?? 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: prompt }],
  }
}
function anthropicFormatResponse(data: any): string {
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('Anthropic returned no content in content[0].text')
  return text as string
}

// ── OpenRouter: same as OpenAI but with HTTP-Referer header ─
function openrouterExtraHeaders(): Record<string, string> {
  return {
    'HTTP-Referer': 'https://bizautomate.ai',
    'X-Title': 'BizAutomate',
  }
}

// ── Provider registry ────────────────────────────────────────
export const PROVIDERS: Record<string, ProviderConfig> = {
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'google/gemini-2.5-flash-lite',
    authStyle: 'bearer',
    extraHeaders: openrouterExtraHeaders,
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    authStyle: 'bearer',
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com',
    defaultModel: 'claude-3-5-sonnet-20241022',
    authStyle: 'header',
    extraHeaders: () => ({ 'anthropic-version': '2023-06-01' }),
    formatRequest: anthropicFormatRequest,
    formatResponse: anthropicFormatResponse,
    chatPath: '/v1/messages',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash-lite',
    authStyle: 'query',
    formatRequest: geminiFormatRequest,
    formatResponse: geminiFormatResponse,
    chatPath: '/models/{model}:generateContent',
    useQueryAuth: true,
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-chat',
    authStyle: 'bearer',
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
  // Meta hosts Llama on multiple providers; OpenRouter is the
  // easiest path. But we also support llama.cpp / together.ai
  // style endpoints via the `custom` provider with a base URL.
  meta: {
    id: 'meta',
    label: 'Meta Llama (via OpenRouter)',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
    authStyle: 'bearer',
    extraHeaders: openrouterExtraHeaders,
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
  mistral: {
    id: 'mistral',
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
    authStyle: 'bearer',
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    authStyle: 'bearer',
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
  xai: {
    id: 'xai',
    label: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-2-latest',
    authStyle: 'bearer',
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
  cohere: {
    id: 'cohere',
    label: 'Cohere',
    baseUrl: 'https://api.cohere.com/v1',
    defaultModel: 'command-r-plus',
    authStyle: 'bearer',
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    defaultModel: 'llama-3.1-sonar-large-128k-online',
    authStyle: 'bearer',
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
  // `custom` — user provides a base URL (Together, Anyscale,
  // OpenRouter-as-OpenAI, self-hosted llama.cpp / vLLM / ollama,
  // etc.). Uses the OpenAI chat completions shape.
  custom: {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    baseUrl: '',  // user provides
    defaultModel: 'default',
    authStyle: 'bearer',
    formatRequest: openaiFormatRequest,
    formatResponse: openaiFormatResponse,
    chatPath: '/chat/completions',
  },
}

// ─── Key resolution ──────────────────────────────────────────
// Looks up the user's key from user_api_keys, falling back to
// the operator's env vars. Returns { provider, key, model }.
async function resolveKey(
  supabaseAdmin: any,
  userId: string,
  requestedProvider?: string
): Promise<{ provider: string; key: string; model: string; baseUrl?: string }> {
  // 1) Per-user key (preferred)
  const encPass = Deno.env.get("USER_KEY_ENC_PASS");
  if (encPass) {
    const { data, error } = await supabaseAdmin.rpc("get_user_api_key", {
      p_user_id: userId,
      p_passphrase: encPass,
    });
    if (!error && data && data.length > 0 && data[0]?.api_key) {
      const row = data[0];
      return {
        provider: row.provider,
        key: row.api_key,
        model: row.default_model,
        baseUrl: row.base_url || undefined,
      };
    }
  }

  // 2) Operator's global env (legacy / self-hosted)
  //    The env var name is the provider id uppercased + "_API_KEY".
  if (requestedProvider) {
    const envName = `${requestedProvider.toUpperCase()}_API_KEY`;
    const envKey = Deno.env.get(envName);
    if (envKey) {
      const cfg = PROVIDERS[requestedProvider] || PROVIDERS.openrouter;
      return { provider: requestedProvider, key: envKey, model: cfg.defaultModel };
    }
  }

  // Also check the most common operator-set keys even if no
  // provider was explicitly requested.
  for (const [pid, cfg] of Object.entries(PROVIDERS)) {
    const envKey = Deno.env.get(`${pid.toUpperCase()}_API_KEY`);
    if (envKey) return { provider: pid, key: envKey, model: cfg.defaultModel };
  }

  // 3) Nothing configured — give the user an actionable error.
  throw new Error(
    "AI is not configured yet. Open Settings → AI → paste your API key for " +
    "OpenAI, Anthropic, Google Gemini, OpenRouter, DeepSeek, Groq, xAI, or any " +
    "OpenAI-compatible provider. Free keys are available from each provider's website."
  );
}

// ─── Single-provider call ────────────────────────────────────
async function callOneProvider(
  providerId: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; baseUrl?: string }
): Promise<{ ok: boolean; status: number; value: string; model: string }> {
  const cfg = PROVIDERS[providerId] || PROVIDERS.openrouter
  const baseUrl = opts.baseUrl || cfg.baseUrl
  const path = cfg.chatPath.replace('{model}', encodeURIComponent(model))
  const url = cfg.useQueryAuth
    ? `${baseUrl}${path}?key=${encodeURIComponent(apiKey)}`
    : `${baseUrl}${path}`

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (cfg.authStyle === "bearer") headers["Authorization"] = `Bearer ${apiKey}`
  if (cfg.authStyle === "header" && providerId === "anthropic") headers["x-api-key"] = apiKey
  if (cfg.extraHeaders) Object.assign(headers, cfg.extraHeaders(apiKey))

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(cfg.formatRequest(model, systemPrompt, prompt, opts)),
    })
    const text = await res.text()
    if (!res.ok) {
      let detail = text.slice(0, 400)
      try {
        const parsed = JSON.parse(text)
        if (parsed?.error?.message) detail = parsed.error.message.slice(0, 400)
      } catch { /* keep raw */ }
      return { ok: false, status: res.status, value: `${cfg.label} error ${res.status}: ${detail}`, model }
    }
    const data = JSON.parse(text)
    const content = cfg.formatResponse(data)
    return { ok: true, status: 200, value: content, model }
  } catch (err) {
    return { ok: false, status: 0, value: `Network error: ${err.message}`, model }
  }
}

// ─── OpenRouter fallback chain (only for the openrouter provider) ─
const OPENROUTER_FALLBACK_MODELS = [
  "google/gemini-2.5-flash-lite",
  "moonshotai/kimi-k3",
  "meta-llama/llama-4-maverick",
  "google/gemini-2.5-flash",
  "tencent/hy3:free",
  "google/gemma-4-26b-a4b-it:free",
]
const FALLBACK_CODES = new Set([402, 429, 403, 408, 409, 413, 500, 502, 503, 504, 529])

/**
 * Call an AI provider with the right per-user key, with
 * OpenRouter-style auto-fallback to free models when the user
 * is on the openrouter provider.
 *
 * Returns { ok, status, value, model }.
 */
export async function callAI(
  supabaseAdmin: any,
  userId: string,
  systemPrompt: string,
  prompt: string,
  opts: { maxTokens?: number; temperature?: number; provider?: string } = {}
): Promise<{ ok: boolean; status: number; value: string; model: string }> {
  const { provider: requested, key, model, baseUrl } = await resolveKey(
    supabaseAdmin, userId, opts.provider
  )

  // For OpenRouter: try the user's chosen model first, then fall
  // back through the free chain. This means the user always
  // gets the model they picked, with a free backup if it's down.
  if (provider === "openrouter" || provider === "meta") {
    // 'meta' also routes through OpenRouter to get the Llama
    // models cleanly. 'custom' is handled normally below.
    const chain = [
      model,
      ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== model),
    ]
    let last: { ok: boolean; status: number; value: string; model: string } = {
      ok: false, status: 0, value: "no models tried", model,
    }
    for (const m of chain) {
      const r = await callOneProvider(provider, key, m, systemPrompt, prompt, { ...opts, baseUrl })
      if (r.ok) return r
      last = r
      if (!FALLBACK_CODES.has(r.status)) return r  // non-fallback error
    }
    return last
  }

  // For all other providers: just one call. No silent fallback
  // (the user picked the provider, so they should see its errors).
  return await callOneProvider(provider, key, model, systemPrompt, prompt, { ...opts, baseUrl })
}

// ─── Provider detection from key shape ───────────────────────
// Used by the Settings UI to auto-pick the provider when the user
// pastes a key. Also used by the edge function to validate.
export function detectProviderFromKey(key: string): { provider: string; model: string } | null {
  const k = (key || "").trim()
  if (!k) return null
  if (k.startsWith("sk-or-v1-"))     return { provider: "openrouter", model: "google/gemini-2.5-flash-lite" }
  if (k.startsWith("sk-ant-"))      return { provider: "anthropic",  model: "claude-3-5-sonnet-20241022" }
  if (k.startsWith("sk-"))          return { provider: "openai",     model: "gpt-4o-mini" }
  if (k.startsWith("AIza"))         return { provider: "gemini",     model: "gemini-2.5-flash-lite" }
  if (k.startsWith("sk-") && k.length > 30) return { provider: "openai", model: "gpt-4o-mini" } // ambiguous fallback
  if (k.length >= 20)               return { provider: "openai",     model: "gpt-4o-mini" } // last-resort default
  return null
}
