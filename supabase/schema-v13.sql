-- ════════════════════════════════════════════════════════════════
-- Schema v13 (OpenRouter provider) — run AFTER schema-v12
-- Adds 'openrouter' as a valid ai_provider option.
--
-- The OpenRouter API key MUST be set as a Supabase secret (never DB):
--   supabase secrets set OPENROUTER_API_KEY=sk-or-v1-...
-- ════════════════════════════════════════════════════════════════

alter table public.profiles drop constraint if exists profiles_ai_provider_check;
alter table public.profiles add constraint profiles_ai_provider_check
  check (ai_provider in ('openai', 'gemini', 'anthropic', 'vercel_gateway', 'openrouter'));

-- Fallback chain used by the edge functions (defined in code, not DB):
--   1. google/gemini-2.5-flash-lite  (Gemini first — fast + cheap)
--   2. moonshotai/kimi-k3            (Kimi K3)
--   3. meta-llama/llama-4-maverick   (Llama)
--   4. google/gemini-2.5-flash       (alternate Gemini)
--   5. tencent/hy3:free              (guaranteed free fallback)
--   6. google/gemma-4-26b-a4b-it:free (another free fallback)
-- Auto-advances on 402 (credits), 429 (rate limit), 5xx (down).
