import { createClient } from '@supabase/supabase-js'

// ── Supabase configuration ─────────────────────────────────────────
// Credentials come from environment variables ONLY. The browser anon key is
// public by design; every table/function still requires RLS/JWT enforcement.
export const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
export const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '')

export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
export const SUPABASE_FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : ''
export const edgeFunctionUrl = (name: string) => `${SUPABASE_FUNCTIONS_URL}/${name}`

/**
 * The ref (subdomain) of the Supabase project the frontend is pointing at.
 * Used to catch the most common "login broken but user is fine" cause: the
 * deployed app still points at an old/deleted project, so Auth returns an
 * opaque error instead of a real one.
 */
export const SUPABASE_REF = (() => {
  if (!SUPABASE_URL) return ''
  try {
    const host = new URL(SUPABASE_URL).hostname
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match ? match[1] : ''
  } catch {
    return ''
  }
})()

/**
 * Anon keys are JWTs that contain the project ref they belong to. Decoding
 * the payload (no verification needed) lets us catch the common deploy bug:
 * URL from project A with an API key from project B. That mismatch makes
 * auth return an opaque error even though the user is online.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  const base64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  try {
    return JSON.parse(atob(padded)) as Record<string, unknown>
  } catch {
    return null
  }
}

export const SUPABASE_ANON_KEY_REF = (() => {
  const payload = decodeJwtPayload(SUPABASE_ANON_KEY)
  if (!payload) return ''
  if (typeof payload.ref === 'string' && payload.ref) return payload.ref
  if (typeof payload['project-ref'] === 'string' && payload['project-ref']) return payload['project-ref']
  if (typeof payload.iss === 'string') {
    try {
      return new URL(payload.iss).hostname.split('.')[0] || ''
    } catch {
      return ''
    }
  }
  return ''
})()

// The live project in supabase/config.toml. The old project
// (oxlwbxkifyrhggrsaoin.supabase.co) no longer resolves and must not be used.
const EXPECTED_SUPABASE_REF = 'prwvaetatdidsugczluv'
const KNOWN_BROKEN_SUPABASE_REF = 'oxlwbxkifyrhggrsaoin'

export const supabaseConfigIssue = (() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return 'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in the hosting environment.'
  }
  if (/placeholder|your-project|your-anon-key|placeholder-key/.test(`${SUPABASE_URL} ${SUPABASE_ANON_KEY}`)) {
    return 'The app is still using placeholder Supabase credentials. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your live project values, then redeploy.'
  }
  if (SUPABASE_REF === KNOWN_BROKEN_SUPABASE_REF) {
    return `VITE_SUPABASE_URL points to the old/deleted project ${SUPABASE_URL}. Point it to https://${EXPECTED_SUPABASE_REF}.supabase.co and redeploy.`
  }
  if (SUPABASE_REF && SUPABASE_ANON_KEY_REF && SUPABASE_REF !== SUPABASE_ANON_KEY_REF) {
    return `VITE_SUPABASE_URL is project ${SUPABASE_REF}, but VITE_SUPABASE_ANON_KEY belongs to project ${SUPABASE_ANON_KEY_REF}. Use a key from the same project as the URL.`
  }
  if (SUPABASE_URL && !SUPABASE_REF) {
    return `VITE_SUPABASE_URL (${SUPABASE_URL}) is not a recognizable Supabase project URL. Use the API URL from Supabase → Project Settings → API.`
  }
  return ''
})()

// createClient requires a URL even for a deliberately unconfigured local
// shell. AuthProvider stops all requests in that case and the UI shows a
// useful setup error instead of silently sending data to a fake project.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
)

export const AI_FUNCTION_URL = edgeFunctionUrl('ai-automation')
