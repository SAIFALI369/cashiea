-- ════════════════════════════════════════════════════════════════
-- Schema v14 (Connect Apps) — run AFTER schema-v13
-- Adds: connected_apps (the secure integration data model) +
--        integration_audit_logs
-- ════════════════════════════════════════════════════════════════

-- ─── CONNECTED APPS (generic, supports any future integration) ──
create table if not exists public.connected_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null,                          -- 'google-sheets', 'gmail', etc.
  app_name text not null,                          -- display name
  provider_account_id text,                        -- Google user ID
  provider_email text,                             -- connected account email
  permission_mode text not null default 'read_only'
    check (permission_mode in ('read_only', 'read_write', 'full_access')),
  access_token text,                               -- stored encrypted at app layer
  refresh_token text,                              -- stored encrypted at app layer
  token_expires_at timestamptz,
  scopes_granted text[],                           -- OAuth scopes granted
  status text not null default 'not_connected'
    check (status in ('not_connected','connecting','connected','token_expired','re_auth_required','error','disconnected')),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,     -- extra app-specific data
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One active connection per app per user
  unique (user_id, app_slug)
);

alter table public.connected_apps enable row level security;
create policy "Owner can manage connected apps" on public.connected_apps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_connected_apps_user on public.connected_apps (user_id, app_slug);

-- ─── INTEGRATION AUDIT LOGS ─────────────────────────────────────
create table if not exists public.integration_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  app_slug text not null,
  action_type text not null,                       -- 'connection_started','oauth_success', etc.
  status text not null default 'success',           -- 'success' | 'failed'
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.integration_audit_logs enable row level security;
create policy "Owner can view audit logs" on public.integration_audit_logs
  for select using (auth.uid() = user_id);
create policy "Owner can insert audit logs" on public.integration_audit_logs
  for insert with check (auth.uid() = user_id);

create index if not exists idx_audit_logs_user on public.integration_audit_logs (user_id, created_at desc);

-- ─── Helper: log an audit event (callable from edge functions via service role) ─
create or replace function public.log_integration_event(
  p_user_id uuid,
  p_app_slug text,
  p_action_type text,
  p_status text default 'success',
  p_error_message text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.integration_audit_logs (user_id, app_slug, action_type, status, error_message, metadata)
  values (p_user_id, p_app_slug, p_action_type, p_status, p_error_message, p_metadata);
$$;
