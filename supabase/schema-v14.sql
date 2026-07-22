-- ════════════════════════════════════════════════════════════════
-- Schema v14 (Per-user AI provider + encrypted key)
-- Run AFTER schema-v13.
--
-- Adds a `user_api_keys` table that stores each user's own AI
-- API key (OpenAI, Anthropic, Google Gemini, OpenRouter,
-- DeepSeek, Meta, Mistral, Groq, xAI Grok, Cohere, etc.),
-- encrypted at rest with pgcrypto, plus the user's preferred
-- default model for that provider.
--
-- Why: previously the only way to use AI was to set provider
-- keys as Supabase secrets (operator-level). That blocked the
-- per-tenant model this app uses. Now every shop owner plugs
-- in their own key in under a minute from the Settings page —
-- no CLI, no operator action.
--
-- The edge functions read the encrypted key via SECURITY DEFINER
-- RPCs, decrypt with the USER_KEY_ENC_PASS Supabase secret, and
-- dispatch to the right provider URL. The plaintext key never
-- leaves the backend.
-- ════════════════════════════════════════════════════════════════

-- Enable pgcrypto for symmetric encryption (if not already).
create extension if not exists pgcrypto;

-- ── user_api_keys ────────────────────────────────────────────
-- One row per user. Stores the encrypted API key, the provider
-- it belongs to, and the user's preferred default model.
create table if not exists public.user_api_keys (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  -- Provider family: 'openai', 'anthropic', 'gemini', 'openrouter',
  -- 'deepseek', 'meta', 'mistral', 'groq', 'xai', 'cohere',
  -- 'perplexity', 'ai21', 'replicate', 'custom' (OpenAI-compatible).
  provider       text not null default 'openrouter',
  -- The encrypted key (pgp_sym_encrypt with USER_KEY_ENC_PASS).
  encrypted_key  bytea not null,
  -- Last 4 chars of the plaintext key, for display ("…4a2b").
  key_hint       text,
  -- User's preferred default model for this provider.
  -- Examples:
  --   openai:      'gpt-4o-mini', 'gpt-4o', 'o1-mini'
  --   anthropic:   'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'
  --   gemini:      'gemini-2.5-flash-lite', 'gemini-2.5-flash'
  --   openrouter:  'google/gemini-2.5-flash-lite', 'anthropic/claude-3.5-sonnet'
  --   deepseek:    'deepseek-chat', 'deepseek-reasoner'
  --   meta:        'meta-llama/llama-3.3-70b-instruct:fast'
  --   groq:        'llama-3.3-70b-versatile', 'mixtral-8x7b-32768'
  --   xai:         'grok-2', 'grok-2-mini'
  --   mistral:     'mistral-large-latest'
  --   perplexity:  'llama-3.1-sonar-large-128k-online'
  default_model  text not null default 'google/gemini-2.5-flash-lite',
  -- Custom base URL (for OpenAI-compatible providers like
  -- Together, Anyscale, OpenRouter-as-OpenAI, self-hosted, etc).
  -- Null for the standard providers.
  base_url       text,
  -- Free-form label so users can name their key (e.g. "My work OpenAI").
  label          text,
  updated_at     timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────
-- A user can read/write ONLY their own row. Edge functions use
-- the service-role key to bypass RLS when actually calling the
-- model (the key never leaves the backend).
alter table public.user_api_keys enable row level security;

drop policy if exists "users read own api key"   on public.user_api_keys;
drop policy if exists "users upsert own api key" on public.user_api_keys;
drop policy if exists "users update own api key" on public.user_api_keys;
drop policy if exists "users delete own api key" on public.user_api_keys;

create policy "users read own api key"
  on public.user_api_keys for select
  using (auth.uid() = user_id);

create policy "users upsert own api key"
  on public.user_api_keys for insert
  with check (auth.uid() = user_id);

create policy "users update own api key"
  on public.user_api_keys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete own api key"
  on public.user_api_keys for delete
  using (auth.uid() = user_id);

-- ── Index for the common "lookup by user_id" path ───────────
create index if not exists user_api_keys_user_id_idx
  on public.user_api_keys (user_id);

-- ── updated_at trigger ──────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists user_api_keys_updated_at on public.user_api_keys;
create trigger user_api_keys_updated_at
  before update on public.user_api_keys
  for each row execute procedure public.set_updated_at();

-- ════════════════════════════════════════════════════════════════
-- HELPER FUNCTIONS used by the edge functions
-- ════════════════════════════════════════════════════════════════

-- Reads + decrypts the user's own AI key. Returns the provider,
-- decrypted key, default model, and optional custom base URL.
-- If the user hasn't set one, returns no rows (edge function then
-- falls back to the operator's global *_API_KEY env vars).
--
-- IMPORTANT: the encryption passphrase is stored as a Supabase
-- secret — set with:
--   supabase secrets set USER_KEY_ENC_PASS=<a-long-random-string>
--
-- The Deno edge function reads USER_KEY_ENC_PASS via Deno.env and
-- passes it in. The SQL function takes the passphrase as a
-- parameter so the secret never appears in the SQL layer.
create or replace function public.get_user_api_key(p_user_id uuid, p_passphrase text)
returns table(
  provider text,
  api_key text,
  default_model text,
  base_url text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select
      user_api_keys.provider,
      pgp_sym_decrypt(user_api_keys.encrypted_key, p_passphrase) as api_key,
      user_api_keys.default_model,
      user_api_keys.base_url
    from public.user_api_keys
    where user_api_keys.user_id = p_user_id;
end $$;

-- Encrypts + stores a key for the given user. Used by the
-- set-user-api-key edge function. The plaintext is passed over
-- the service-role connection (server-to-server) and never
-- leaves the backend.
create or replace function public.encrypt_user_api_key(
  p_user_id       uuid,
  p_provider      text,
  p_plaintext_key text,
  p_passphrase    text,
  p_default_model text,
  p_base_url      text default null,
  p_label         text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hint text;
begin
  -- Last 4 chars of the key, for display ("…4a2b"). Fall back to
  -- the last 4 of whatever we have, in case the key is shorter.
  v_hint := right(p_plaintext_key, 4);

  insert into public.user_api_keys (
    user_id, provider, encrypted_key, key_hint,
    default_model, base_url, label, updated_at
  )
  values (
    p_user_id,
    p_provider,
    pgp_sym_encrypt(p_plaintext_key, p_passphrase),
    v_hint,
    coalesce(p_default_model, 'google/gemini-2.5-flash-lite'),
    p_base_url,
    p_label,
    now()
  )
  on conflict (user_id) do update set
    provider       = excluded.provider,
    encrypted_key  = excluded.encrypted_key,
    key_hint       = excluded.key_hint,
    default_model  = excluded.default_model,
    base_url       = excluded.base_url,
    label          = excluded.label,
    updated_at     = now();
end $$;

-- Returns the user's key status WITHOUT revealing the key.
-- Safe to call from the frontend (RLS-enforced).
-- Returns { has_key, provider, hint, model } or 0 rows if not set.
create or replace function public.get_user_api_key_status()
returns table(has_key boolean, provider text, hint text, model text)
language sql
security invoker
set search_path = public
as $$
  select
    true as has_key,
    user_api_keys.provider,
    user_api_keys.key_hint as hint,
    user_api_keys.default_model as model
  from public.user_api_keys
  where user_id = auth.uid();
$$;

-- ── Grants ──────────────────────────────────────────────────
grant execute on function public.get_user_api_key_status() to authenticated;
grant execute on function public.encrypt_user_api_key(uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.get_user_api_key(uuid, text) to service_role;
revoke all on function public.encrypt_user_api_key(uuid, text, text, text, text, text, text) from public;
revoke all on function public.get_user_api_key(uuid, text) from public;

-- ── Drop the old v14 functions if you ran an early version ──
-- (idempotent: safe to run multiple times)
drop function if exists public.get_user_openrouter_key(uuid, text);
drop function if exists public.encrypt_user_openrouter_key(uuid, text, text, text);
drop function if exists public.get_user_openrouter_status();

-- ── Migrate default provider to 'openrouter' for existing users ──
-- (New sign-ups get openrouter by default since the model is set in
--  handle_new_user trigger; this catches anyone on the old default.)
update public.profiles
   set ai_provider = 'openrouter'
 where ai_provider in ('openai', 'vercel_gateway')
   and not exists (
     select 1 from public.user_api_keys k where k.user_id = profiles.id
   );

-- Expand the provider check to allow the new set of providers
-- the user can pick from in Settings.
alter table public.profiles drop constraint if exists profiles_ai_provider_check;
alter table public.profiles add constraint profiles_ai_provider_check
  check (ai_provider in (
    'openai','anthropic','gemini','openrouter',
    'deepseek','meta','mistral','groq','xai',
    'cohere','perplexity','ai21','replicate','custom'
  ));
