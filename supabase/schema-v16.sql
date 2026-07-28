-- ════════════════════════════════════════════════════════════════
-- schema-v16 — WhatsApp message log + PKCE OAuth state store
-- Applied live via the Management API; safe to re-run (idempotent-ish).
-- ════════════════════════════════════════════════════════════════

-- WhatsApp messages: inbound (from webhook) + outbound (from send).
-- user_id is the resolved shop owner (nullable for unmatched inbound).
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  from_phone text,
  to_phone text,
  body text,
  direction text not null default 'inbound' check (direction in ('inbound','outbound')),
  status text not null default 'received' check (status in ('received','sent','failed','delivered','read')),
  wa_message_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_messages_user_idx on public.whatsapp_messages(user_id, created_at desc);
alter table public.whatsapp_messages enable row level security;
drop policy if exists "Owner can read own messages" on public.whatsapp_messages;
create policy "Owner can read own messages" on public.whatsapp_messages
  for select using ((select auth.uid()) = user_id);
drop policy if exists "Owner can insert own messages" on public.whatsapp_messages;
create policy "Owner can insert own messages" on public.whatsapp_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- PKCE verifier store for OAuth flows with PKCE (e.g. Canva Connect).
-- Service-role only (no public RLS policy); rows are short-lived.
create table if not exists public.oauth_pending (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  code_verifier text,
  created_at timestamptz not null default now()
);
alter table public.oauth_pending enable row level security;
