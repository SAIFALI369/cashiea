-- ════════════════════════════════════════════════════════════════
-- Schema v3 — run AFTER schema.sql + schema-additions.sql
-- Adds: activity logs, API keys, email campaigns, tracking, trial
-- ════════════════════════════════════════════════════════════════

-- ─── Trial support on profiles ──────────────────────────────────
alter table public.profiles add column if not exists trial_ends_at timestamptz;

-- Give all new users a 14-day Pro trial (set via trigger-safe update)
create or replace function public.grant_trial(user_uuid uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles
  set trial_ends_at = now() + interval '14 days',
      updated_at = now()
  where id = user_uuid and trial_ends_at is null;
$$;

-- ─── ACTIVITY LOGS (drives the "saved hours/money" tracker) ─────
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('invoice','report','extract','summary','email','sentiment','campaign')),
  description text,
  time_saved_minutes integer not null default 0,
  money_saved numeric(10,2) not null default 0,
  provider text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;
create policy "Owner can view activity logs" on public.activity_logs
  for select using (auth.uid() = user_id);
create policy "Owner can insert activity logs" on public.activity_logs
  for insert with check (auth.uid() = user_id);

-- ─── API KEYS (for 3rd-party /api integrations) ─────────────────
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_prefix text not null,       -- visible part e.g. biz_live_ab12
  key_hash text not null unique,  -- sha256 of full key
  last_used_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;
create policy "Owner can manage api keys" on public.api_keys
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── EMAIL CAMPAIGNS ────────────────────────────────────────────
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','paused')),
  template_subject text,
  template_body text,
  tone text not null default 'professional',
  ab_enabled boolean not null default false,
  variant_a_subject text,
  variant_b_subject text,
  followup_enabled boolean not null default false,
  followup_delay_days integer not null default 2,
  followup_count integer not null default 1,
  scheduled_at timestamptz,
  sent_count integer not null default 0,
  opened_count integer not null default 0,
  clicked_count integer not null default 0,
  replied_count integer not null default 0,
  provider text default 'openai',
  created_at timestamptz not null default now()
);

alter table public.email_campaigns enable row level security;
create policy "Owner can manage campaigns" on public.email_campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── CAMPAIGN RECIPIENTS (per-person tracking) ──────────────────
create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.email_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text,
  personalization jsonb not null default '{}'::jsonb,
  variant text,                   -- 'a' | 'b'
  status text not null default 'pending' check (status in ('pending','sent','opened','clicked','replied','bounced')),
  sentiment text,                 -- positive | negative | neutral
  sentiment_score numeric(3,2),
  generated_subject text,
  generated_body text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.campaign_recipients enable row level security;
create policy "Owner can manage recipients" on public.campaign_recipients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Helper: roll up recipient counts onto a campaign ───────────
create or replace function public.sync_campaign_stats(campaign_uuid uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.email_campaigns c set
    sent_count   = (select count(*) from public.campaign_recipients where campaign_id = campaign_uuid and status in ('sent','opened','clicked','replied')),
    opened_count = (select count(*) from public.campaign_recipients where campaign_id = campaign_uuid and status in ('opened','clicked','replied')),
    clicked_count= (select count(*) from public.campaign_recipients where campaign_id = campaign_uuid and status in ('clicked','replied')),
    replied_count= (select count(*) from public.campaign_recipients where campaign_id = campaign_uuid and status = 'replied')
  where c.id = campaign_uuid;
$$;
