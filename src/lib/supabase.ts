import { createClient } from '@supabase/supabase-js'

// ── Supabase configuration ─────────────────────────────────────────
// Credentials come from environment variables ONLY. The browser anon key is
// public by design; every table/function still requires RLS/JWT enforcement.
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '')

export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
export const SUPABASE_FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : ''
export const edgeFunctionUrl = (name: string) => `${SUPABASE_FUNCTIONS_URL}/${name}`

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
