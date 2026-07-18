-- ════════════════════════════════════════════════════════════════
-- Schema v9 (Vercel AI Gateway provider) — run AFTER schema-v8
-- Adds 'vercel_gateway' as a valid ai_provider option.
-- ════════════════════════════════════════════════════════════════

-- Drop & recreate the check constraint to allow the gateway provider.
-- (profiles.ai_provider currently allows: openai | gemini | anthropic)
alter table public.profiles drop constraint if exists profiles_ai_provider_check;
alter table public.profiles add constraint profiles_ai_provider_check
  check (ai_provider in ('openai', 'gemini', 'anthropic', 'vercel_gateway'));

-- NOTE: the AI Gateway key must be set as a Supabase secret, NEVER in the DB:
--   supabase secrets set AI_GATEWAY_API_KEY=vck_...
--
-- Default model used by the app through the gateway:
--   openai/gpt-4o-mini   (cheap: $0.15/M in, $0.60/M out)
-- Alternatives good for retail (cheaper):
--   google/gemini-2.5-flash-lite   ($0.10/$0.40)
--   deepseek/deepseek-v3.1         ($0.25/$0.95)
