-- ════════════════════════════════════════════════════════════════
-- Schema Additions — run AFTER schema.sql in the Supabase SQL Editor
-- Adds: emails table (for the AI Email Assistant feature)
-- ════════════════════════════════════════════════════════════════

-- ─── EMAILS ─────────────────────────────────────────────────────
create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  recipient text,
  email_type text not null check (email_type in ('cold_outreach', 'follow_up', 'proposal', 'newsletter', 'support_reply', 'custom')),
  tone text not null default 'professional' check (tone in ('professional', 'friendly', 'persuasive', 'formal', 'casual')),
  key_points text,
  generated_body text,
  provider text default 'openai',
  created_at timestamptz not null default now()
);

-- RLS — owner only
alter table public.emails enable row level security;

create policy "Owner can manage emails" on public.emails
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── UNIQUE CONSTRAINT on subscriptions ─────────────────────────
-- Allows clean upserts from the Stripe webhook
create unique index if not exists subscriptions_user_id_unique
  on public.subscriptions (user_id);

-- ─── subscription.current_period_end should be nullable ─────────
-- (already nullable in schema.sql, nothing to do — kept for clarity)
