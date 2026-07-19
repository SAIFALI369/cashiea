-- COMBINED SCHEMA (v3) — run ONCE in the Supabase SQL Editor.
-- All 12 schema files merged in dependency order. Idempotent.

-- >>> schema.sql <<<
-- ════════════════════════════════════════════════════════════════
-- BizAutomate AI — Database Schema
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

-- >>> schema-additions.sql <<<
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
  email_type text not null check (email_type in ('winback', 'offer', 'thankyou', 'abandoned', 'newsletter', 'custom')),
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

-- >>> schema-v3.sql <<<
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

-- >>> schema-v4.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v4 (Retail POS) — run AFTER schema.sql + additions + v3
-- Adds: products, customers, transactions (cashier/POS core)
-- ════════════════════════════════════════════════════════════════

-- ─── PRODUCTS (catalog + inventory) ─────────────────────────────
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  sku text,
  category text default 'general',
  price numeric(12,2) not null default 0,
  cost numeric(12,2) not null default 0,
  stock_quantity integer not null default 0,
  low_stock_threshold integer not null default 5,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
create policy "Owner can manage products" on public.products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── CUSTOMERS (CRM / client details) ───────────────────────────
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  company text,
  notes text,
  tags text[] not null default '{}',
  total_spent numeric(12,2) not null default 0,
  total_orders integer not null default 0,
  loyalty_points integer not null default 0,
  first_purchase_at timestamptz,
  last_purchase_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;
create policy "Owner can manage customers" on public.customers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── TRANSACTIONS (POS checkout / sales) ────────────────────────
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  receipt_number text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_method text not null default 'cash' check (payment_method in ('cash','card','upi','wallet','other')),
  status text not null default 'completed' check (status in ('completed','refunded','void')),
  notes text,
  served_by text,
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;
create policy "Owner can manage transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Index for the overview dashboard aggregations
create index if not exists idx_transactions_user_created on public.transactions (user_id, created_at desc);
create index if not exists idx_customers_user on public.customers (user_id);
create index if not exists idx_products_user on public.products (user_id);

-- ─── Helper: recompute a customer's lifetime stats ──────────────
create or replace function public.recompute_customer_stats(customer_uuid uuid)
returns void
language sql
security definer set search_path = public
as $$
  with agg as (
    select
      coalesce(sum(total), 0) as spent,
      count(*) as orders,
      min(created_at) as first_p,
      max(created_at) as last_p
    from public.transactions
    where customer_id = customer_uuid and status = 'completed'
  )
  update public.customers c set
    total_spent = agg.spent,
    total_orders = agg.orders,
    first_purchase_at = agg.first_p,
    last_purchase_at = agg.last_p
  from agg
  where c.id = customer_uuid;
$$;

-- ─── Helper: decrement product stock (atomic) ───────────────────
create or replace function public.decrement_stock(p_id uuid, qty integer)
returns void
language sql
security definer set search_path = public
as $$
  update public.products
  set stock_quantity = greatest(0, stock_quantity - qty),
      updated_at = now()
  where id = p_id;
$$;

-- >>> schema-v5.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v5 (Retail ERP) — run AFTER schema.sql + additions + v3 + v4
-- Adds: suppliers, purchase_orders, quotations, expenses + GST field
-- ════════════════════════════════════════════════════════════════

-- ─── GSTIN on profiles (India GST) ──────────────────────────────
alter table public.profiles add column if not exists gstin text;
alter table public.profiles add column if not exists business_address text;
alter table public.profiles add column if not exists business_state text;

-- ─── SUPPLIERS ──────────────────────────────────────────────────
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  gstin text,
  notes text,
  outstanding numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;
create policy "Owner can manage suppliers" on public.suppliers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── PURCHASE ORDERS ────────────────────────────────────────────
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  po_number text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','ordered','received','cancelled')),
  expected_date date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.purchase_orders enable row level security;
create policy "Owner can manage purchase orders" on public.purchase_orders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── QUOTATIONS ─────────────────────────────────────────────────
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  quote_number text not null,
  customer_name text not null,
  customer_email text,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric(12,2) not null default 0,
  tax_rate numeric(5,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','accepted','converted','rejected','expired')),
  valid_until date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.quotations enable row level security;
create policy "Owner can manage quotations" on public.quotations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── EXPENSES (Accounts) ────────────────────────────────────────
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null default 'general',
  description text not null,
  amount numeric(12,2) not null,
  type text not null default 'expense' check (type in ('expense','income')),
  payment_method text,
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;
create policy "Owner can manage expenses" on public.expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_expenses_user_date on public.expenses (user_id, date desc);
create index if not exists idx_quotations_user on public.quotations (user_id);
create index if not exists idx_purchase_orders_user on public.purchase_orders (user_id);

-- ─── Helper: recompute supplier outstanding from POs ────────────
create or replace function public.recompute_supplier_outstanding(supplier_uuid uuid)
returns void
language sql
security definer set search_path = public
as $$
  with agg as (
    select coalesce(sum(total), 0) as owed
    from public.purchase_orders
    where supplier_id = supplier_uuid and status in ('ordered','received')
  )
  update public.suppliers s set outstanding = agg.owed from agg
  where s.id = supplier_uuid;
$$;

-- >>> schema-v6.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v6 (AI Business Brain) — run AFTER schema.sql + additions + v3-5
-- Adds: integrations, business_memory, ai_predictions, ai_corrections
-- ════════════════════════════════════════════════════════════════

-- ─── INTEGRATIONS (Gmail, Google Sheets, manual sources, etc.) ──
-- Stores connection state. OAuth tokens are encrypted/optional.
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail','google_sheets','manual','whatsapp','shopify','razorpay','tally','excel')),
  label text,
  status text not null default 'disconnected' check (status in ('disconnected','connected','error')),
  metadata jsonb not null default '{}'::jsonb,    -- e.g. { connected_email, spreadsheet_id }
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.integrations enable row level security;
create policy "Owner can manage integrations" on public.integrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── BUSINESS MEMORY (the AI's living "About My Business" summary) ─
create table if not exists public.business_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text,                                   -- the synthesized business overview
  business_type text,                             -- e.g. "Building materials retailer"
  key_facts jsonb not null default '[]'::jsonb,   -- [{fact, source, confidence}]
  preferences jsonb not null default '{}'::jsonb, -- learned owner preferences
  last_updated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.business_memory enable row level security;
create policy "Owner can manage business memory" on public.business_memory
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── AI PREDICTIONS (proposed tasks awaiting approve/deny) ──────
create table if not exists public.ai_predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prediction_type text not null check (prediction_type in ('reorder','followup','invoice','offer','alert','expense','custom')),
  title text not null,
  description text,
  rationale text,                                 -- why the AI thinks this
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'pending' check (status in ('pending','approved','denied','executed','dismissed')),
  action_payload jsonb not null default '{}'::jsonb, -- data needed to execute
  owner_feedback text,                            -- why approved/denied (feeds learning)
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

alter table public.ai_predictions enable row level security;
create policy "Owner can manage predictions" on public.ai_predictions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_predictions_user_status on public.ai_predictions (user_id, status);

-- ─── AI CORRECTIONS / LEARNING LOG ─────────────────────────────
-- Every time the owner corrects the AI, we store it. The brain edge
-- function pulls recent corrections into the prompt so the AI adapts.
create table if not exists public.ai_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,                         -- 'prediction', 'summary', 'output'
  context text,                                   -- what the AI said/did
  correction text not null,                       -- what the owner wanted instead
  created_at timestamptz not null default now()
);

alter table public.ai_corrections enable row level security;
create policy "Owner can manage corrections" on public.ai_corrections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_corrections_user on public.ai_corrections (user_id, created_at desc);

-- >>> schema-v7.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v7 (Daily Brain cron + briefing opt-in) — run AFTER schema-v6
-- ════════════════════════════════════════════════════════════════

-- Opt-in flag for the daily morning briefing email (default: on)
alter table public.profiles add column if not exists daily_briefing boolean not null default true;

-- ─── pg_cron schedule for the daily-brain edge function ─────────
-- Runs at 7:00 AM server time daily. Requires the pg_cron extension.
-- The function call uses the service role key (set via a stored secret).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Store the service-role key for the cron job to call the function.
-- Replace the placeholder with your actual service role key, then run.
-- (We keep this as a manual step so the key isn't in source control.)
-- CREATE OR REPLACE FUNCTION public._run_daily_brain() RETURNS void
-- AS $$
-- DECLARE
--   req_url text;
-- BEGIN
--   req_url := current_setting('app.functions_url') || '/daily-brain';
--   PERFORM net.http_post(
--     url := req_url,
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || current_setting('app.service_role_key')
--     ),
--     body := jsonb_build_object('opted_in_only', true)
--   );
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule: 7:00 AM daily
-- SELECT cron.schedule(
--   'daily-brain',
--   '0 7 * * *',
--   $$SELECT cron.alter_job(job_id, database := 'postgres');$$
-- );
-- NOTE: The exact scheduling syntax depends on your Supabase version.
-- Easiest path: use the Supabase Dashboard → Database → Scheduled Functions,
-- or run from the edge function with a separate scheduler service.

-- >>> schema-v8.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v8 (Payments + Team + Reminders) — run AFTER schema-v7
-- Adds: team_members, payment fields on invoices, reminder tracking
-- ════════════════════════════════════════════════════════════════

-- ─── Payment fields on invoices (UPI / online payments) ─────────
alter table public.invoices add column if not exists client_phone text;
alter table public.invoices add column if not exists upi_id text;          -- merchant's UPI VPA e.g. shop@paytm
alter table public.invoices add column if not exists payment_link text;     -- generated UPI deep link
alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists reminder_count integer not null default 0;
alter table public.invoices add column if not exists last_reminder_at timestamptz;
-- Status is now: draft | sent | viewed | paid | partial | overdue

-- ─── TEAM MEMBERS (roles & permissions) ─────────────────────────
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,    -- the OWNER
  member_email text not null,                                            -- invited member's email
  member_user_id uuid references auth.users(id) on delete set null,     -- resolved once they sign up
  name text,
  role text not null default 'staff' check (role in ('owner','manager','accountant','staff')),
  status text not null default 'invited' check (status in ('invited','active','revoked')),
  permissions jsonb not null default '{"pos":true,"invoices":true,"reports":true}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.team_members enable row level security;
create policy "Owner can manage team" on public.team_members
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── Invoice reminder log ───────────────────────────────────────
create table if not exists public.invoice_reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp','upi')),
  sent_at timestamptz not null default now(),
  notes text
);

alter table public.invoice_reminders enable row level security;
create policy "Owner can manage reminders" on public.invoice_reminders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_invoices_status_due on public.invoices (user_id, status, due_date);
create index if not exists idx_team_members_user on public.team_members (user_id);

-- >>> schema-v9.sql <<<
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

-- >>> schema-v10.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v10 (UPI ID for merchant + fix) — run AFTER schema-v9
-- Adds the merchant's UPI VPA to profiles so invoices can build
-- real upi:// payment links + QR codes.
-- ════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists upi_id text;  -- e.g. shop@okhdfcbank, business@paytm

-- The Invoices page reads profile.upi_id to generate payment links.
-- Users set it in Settings → it powers every invoice's "Pay via UPI"
-- button + scannable QR code.

-- >>> schema-v11.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v11 (Auth + Onboarding flow) — run AFTER schema-v10
-- Adds: phone, shop_category, whatsapp_number, onboarding_step,
--       plan_tier='trial', and a trigger that fires on signup.
-- ════════════════════════════════════════════════════════════════

-- ─── New columns on profiles ────────────────────────────────────
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists shop_category text;
alter table public.profiles add column if not exists whatsapp_number text;
alter table public.profiles add column if not exists onboarding_step integer not null default 0;
alter table public.profiles add column if not exists role text not null default 'owner';
-- onboarding_step: 0=not started, 1=category, 2=items, 3=whatsapp, 4=done

-- ─── plan_tier replaces 'plan' for the trial concept ────────────
-- Keep plan as-is (free/starter/pro/enterprise) but add plan_tier
-- that distinguishes trial vs paid vs free.
alter table public.profiles add column if not exists plan_tier text not null default 'free'
  check (plan_tier in ('free', 'trial', 'paid'));

-- ─── handle_new_user trigger (rewritten to be authoritative) ────
-- This fires ON auth.users INSERT. It's the single source of truth for
-- new-profile creation — clients CANNOT skip or fake it.
-- Reads shop_name, phone from raw_user_meta_data (sent at signup).
-- Sets: role='owner', plan_tier='trial', trial_ends_at = now()+14d,
-- onboarding_step=1 (so the wizard starts at step 1 after login).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, company_name, phone,
    role, plan_tier, trial_ends_at, onboarding_step
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'phone',
    'owner',
    'trial',
    now() + interval '14 days',
    1   -- start onboarding at step 1 (category)
  )
  on conflict (id) do nothing;  -- safe if profile somehow already exists
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── RPCs for the onboarding wizard ─────────────────────────────
-- update_onboarding_step: called after each wizard step completes.
-- Uses the user's JWT auth.uid() so it can't be faked for other users.
create or replace function public.update_onboarding_step(step integer, data jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if step = 1 then
    -- Shop category chosen
    update public.profiles
    set shop_category = data->>'shop_category',
        onboarding_step = greatest(onboarding_step, 2),
        updated_at = now()
    where id = auth.uid();
  elsif step = 2 then
    -- First 3 inventory items added (client also inserts into products table)
    update public.profiles
    set onboarding_step = greatest(onboarding_step, 3),
        updated_at = now()
    where id = auth.uid();
  elsif step = 3 then
    -- WhatsApp number + report time confirmed → onboarding done
    update public.profiles
    set whatsapp_number = data->>'whatsapp_number',
        report_time_utc = coalesce(data->>'report_time_utc', '17:00'),
        onboarding_step = 4,
        updated_at = now()
    where id = auth.uid();
  end if;
end;
$$;

-- >>> schema-v12.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v12 (Daily Reports job) — run AFTER schema-v11
-- Adds: daily_reports, failed_jobs, report_time_utc on profiles
-- ════════════════════════════════════════════════════════════════

-- ─── Owner-configurable report time (UTC HH:MM, default 17:00 = 22:30 IST) ─
alter table public.profiles add column if not exists report_time_utc text not null default '17:00';
alter table public.profiles add column if not exists report_timezone text not null default 'Asia/Kolkata';
-- Allow 'cancelled' as a plan_tier so the job filter is meaningful
alter table public.profiles drop constraint if exists profiles_plan_tier_check;
alter table public.profiles add constraint profiles_plan_tier_check
  check (plan_tier in ('free', 'trial', 'paid', 'cancelled'));

-- ─── DAILY REPORTS (one per shop per day) ───────────────────────
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  report_date date not null,
  total_revenue numeric(12,2) not null default 0,
  transaction_count integer not null default 0,
  top_items jsonb not null default '[]'::jsonb,        -- [{name, qty, revenue}]
  payment_breakdown jsonb not null default '{}'::jsonb,-- {cash: 60, upi: 30, card: 10}
  message_text text,
  status text not null default 'pending' check (status in ('pending','sent','failed','retry')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

alter table public.daily_reports enable row level security;
create policy "Owner can view daily reports" on public.daily_reports
  for select using (auth.uid() = user_id);

-- One report per shop per day (the job uses this to avoid dupes)
create unique index if not exists daily_reports_user_date_unique
  on public.daily_reports (user_id, report_date);

create index if not exists idx_daily_reports_status on public.daily_reports (status, report_date);

-- ─── FAILED JOBS (Task 8 referenced — needed now for retry logging) ──
create table if not exists public.failed_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,                              -- 'daily_report', 'reminder', etc.
  user_id uuid references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,          -- enough to retry
  error text,
  retry_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending','retried','dead')),
  last_attempted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.failed_jobs enable row level security;
create policy "Owner can view failed jobs" on public.failed_jobs
  for select using (auth.uid() = user_id);

create index if not exists idx_failed_jobs_status on public.failed_jobs (status, created_at desc);

-- ─── pg_cron schedule: run the daily-reports function every 30 min ─
-- It self-filters to shops whose report_time_utc matches the current slot
-- AND haven't received today's report yet.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- NOTE: scheduling requires your service-role key as a named setting.
-- Run these manually ONCE after deploy (replace $KEY):
--   alter database current_database() set app.service_role_key to '$KEY';
--   alter database current_database() set app.functions_url to 'https://<proj>.functions.supabase.co';
--   select cron.schedule('daily-reports', '*/30 * * * *',
--     $$ select net.http_post(
--          url := current_setting('app.functions_url') || '/daily-reports',
--          headers := jsonb_build_object('Content-Type','application/json',
--                    'Authorization','Bearer '||current_setting('app.service_role_key')),
--          body := '{}'::jsonb) $$);

