-- ════════════════════════════════════════════════════════════════
-- Cashiea — Database Schema
-- Run this in the Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ─── PROFILES ───────────────────────────────────────────────────
-- Extends auth.users with business/subscription info
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company_name text,
  avatar_url text,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'enterprise')),
  ai_provider text not null default 'openai' check (ai_provider in ('openai', 'gemini', 'anthropic')),
  api_usage_count integer not null default 0,
  api_usage_limit integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── INVOICES ───────────────────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null,
  client_name text not null,
  client_email text,
  client_address text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'overdue')),
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── REPORTS ────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  report_type text not null check (report_type in ('financial', 'sales', 'operations', 'custom')),
  input_data text,
  generated_content text,
  provider text default 'openai',
  created_at timestamptz not null default now()
);

-- ─── DATA ENTRIES ───────────────────────────────────────────────
create table if not exists public.data_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_text text not null,
  extracted_data jsonb not null default '{}'::jsonb,
  category text default 'general',
  provider text default 'openai',
  created_at timestamptz not null default now()
);

-- ─── SUMMARIES ──────────────────────────────────────────────────
create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_text text not null,
  summary_type text not null check (summary_type in ('brief', 'detailed', 'bullets', 'executive')),
  generated_summary text,
  provider text default 'openai',
  word_count integer,
  created_at timestamptz not null default now()
);

-- ─── SUBSCRIPTIONS ──────────────────────────────────────────────
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text not null default 'free',
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due', 'trialing')),
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — every user can only see their own data
-- ════════════════════════════════════════════════════════════════

alter table public.profiles enable row level security;
alter table public.invoices enable row level security;
alter table public.reports enable row level security;
alter table public.data_entries enable row level security;
alter table public.summaries enable row level security;
alter table public.subscriptions enable row level security;

-- PROFILES policies
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Helper macro: all tables follow the same owner-only pattern
-- INVOICES
create policy "Owner can manage invoices" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- REPORTS
create policy "Owner can manage reports" on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DATA ENTRIES
create policy "Owner can manage data entries" on public.data_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SUMMARIES
create policy "Owner can manage summaries" on public.summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SUBSCRIPTIONS
create policy "Owner can manage subscriptions" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════════
-- FUNCTIONS callable from the client (RPC)
-- ════════════════════════════════════════════════════════════════

-- Increment API usage (called by the edge function before processing)
create or replace function public.increment_api_usage(user_uuid uuid)
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles
  set api_usage_count = api_usage_count + 1,
      updated_at = now()
  where id = user_uuid;
$$;

-- Reset monthly usage (call via a scheduled cron or manually)
create or replace function public.reset_monthly_usage()
returns void
language sql
security definer set search_path = public
as $$
  update public.profiles set api_usage_count = 0, updated_at = now();
$$;

-- ─── UPDATED_AT triggers ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
