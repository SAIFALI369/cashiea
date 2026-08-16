import { createClient } from '@supabase/supabase-js'

// ── Production Supabase project (hardcoded) ──────────────────────────
// Pointed explicitly at the LIVE project so the app works regardless of
// CI/Vercel env vars (which were previously stuck on the abandoned old
// project with dead Auth). The anon key is public-safe (RLS-protected).
// To switch projects later, change these two constants.
const SUPABASE_URL = 'https://prwvaetatdidsugczluv.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByd3ZhZXRhdGRpZHN1Z2N6bHV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDUzNTgsImV4cCI6MjEwMTQyMTM1OH0.OasYlwTZh-Uvpv69hbfTq60VPtj6DN2OFQIj1GPlc30'

export const supabaseConfigured = true

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// URL of the deployed edge function
export const AI_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ai-automation`
