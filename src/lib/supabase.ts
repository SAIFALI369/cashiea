import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// True when the deploy is missing its Supabase config. The app shows a
// clear setup screen in this case instead of a confusing white screen.
export const supabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('localhost:54321') &&
    supabaseAnonKey !== 'placeholder'
)

if (!supabaseConfigured) {
  console.warn(
    '⚠️  Cashiea: Missing Supabase env vars. Copy .env.example to .env and fill in your values, then rebuild.'
  )
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

// URL of the deployed edge function
export const AI_FUNCTION_URL = `${supabaseUrl || 'http://localhost:54321'}/functions/v1/ai-automation`
