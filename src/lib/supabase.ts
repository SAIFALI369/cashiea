import { createClient } from '@supabase/supabase-js'

// ── Supabase configuration ─────────────────────────────────────────
// Credentials come from environment variables ONLY — nothing is hardcoded.
// This enables key rotation, self-hosting, and multi-environment builds.
//
// Setup:
//   Local dev:  copy .env.example → .env.local and fill in your values
//   Production: set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in Vercel
//
// The anon key is public-safe by design (protected by Row Level Security),
// but we still keep it in env vars so it can be rotated without a code change.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

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

export const AI_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ai-automation`
