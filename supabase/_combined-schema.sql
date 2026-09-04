-- COMBINED SCHEMA (v27) — run ONCE in the Supabase SQL Editor.
-- All versioned schema files merged in dependency order. Idempotent where the
-- individual migrations are idempotent; review scheduled jobs before rerunning.


-- >>> schema.sql <<<
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

-- >>> schema-v13.sql <<<
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

-- >>> schema-v14.sql <<<
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

-- >>> schema-v15.sql <<<
-- ════════════════════════════════════════════════════════════════
-- schema-v15 — Profile avatars storage bucket + policies
-- (profiles.avatar_url and profiles.role already exist from earlier migrations)
-- Run once. Safe to re-run (idempotent where possible).
-- ════════════════════════════════════════════════════════════════

-- Public-read bucket so avatar images render in the app; 3 MB cap; images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- NOTE: the public 'avatars' bucket does NOT need a SELECT policy — objects are
-- served by the public URL regardless, and a broad SELECT policy would let
-- anyone list the bucket (linter: public_bucket_allows_listing). Omit it.

-- An authenticated owner can manage only objects inside their own folder
-- (avatars/<user_id>/...). (storage.foldername(name))[1] is the top path segment.
create policy "avatars owner insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- >>> schema-v16.sql <<<
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

-- >>> schema-v17.sql <<<
-- ════════════════════════════════════════════════════════════════
-- schema-v17 — Supabase Database Linter fixes
-- Applied live via the Management API. Safe to re-run.
--
-- 1) WARN auth_rls_initplan — whatsapp_messages policies used bare
--    auth.uid(), which re-evaluates per row. Switch to (select auth.uid())
--    so Postgres plans it once per query.
-- 2) INFO unindexed_foreign_keys — oauth_pending.user_id FK had no index.
-- 3) INFO unused_index — drop 10 flagged single-column indexes that aren't
--    backing any current query (re-add if a feature needs them at scale).
-- ════════════════════════════════════════════════════════════════

-- 1) RLS init-plan fix
drop policy if exists "Owner can read own messages" on public.whatsapp_messages;
drop policy if exists "Owner can insert own messages" on public.whatsapp_messages;
create policy "Owner can read own messages" on public.whatsapp_messages
  for select using ((select auth.uid()) = user_id);
create policy "Owner can insert own messages" on public.whatsapp_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- 2) Cover the oauth_pending.user_id foreign key
create index if not exists oauth_pending_user_id_idx on public.oauth_pending(user_id);

-- 3) Drop unused indexes flagged by the linter
drop index if exists public.whatsapp_messages_from_idx;
drop index if exists public.idx_daily_reports_status;
drop index if exists public.idx_audit_logs_user;
drop index if exists public.idx_campaign_recipients_campaign_id;
drop index if exists public.idx_campaign_recipients_user_id;
drop index if exists public.idx_invoice_reminders_invoice_id;
drop index if exists public.idx_invoice_reminders_user_id;
drop index if exists public.idx_quotations_customer_id;
drop index if exists public.idx_team_members_member_user_id;
drop index if exists public.idx_transactions_customer_id;

-- >>> schema-v18.sql <<<
-- ════════════════════════════════════════════════════════════════
-- schema-v18 — Security linter fixes
-- Applied live via the Management API. Safe to re-run.
--
-- 1) public_bucket_allows_listing — drop the broad SELECT policy on the
--    public 'avatars' bucket. Public buckets serve object URLs without it,
--    so avatars still load; the bucket just can't be listed anymore.
-- 2) anon_security_definer_function_executable — revoke EXECUTE from anon
--    (PUBLIC) on every flagged SECURITY DEFINER function. None should be
--    callable without signing in.
-- 3) authenticated_security_definer_function_executable (trigger/cron fns) —
--    handle_new_user (auth trigger) and reset_monthly_usage (service-role
--    cron) must stay DEFINER, so they lose the authenticated grant instead.
-- 4) authenticated_security_definer_function_executable (client/user-JWT fns) —
--    switch SECURITY DEFINER -> SECURITY INVOKER. Each already operates only on
--    the caller's own rows (RLS: "Owner can manage …" on products/customers/
--    suppliers/profiles/campaigns/transactions/purchase_orders), so INVOKER keeps
--    them working for logged-in users AND removes the privilege-escalation surface
--    (a user can no longer pass a foreign id to touch someone else's data).
-- ════════════════════════════════════════════════════════════════

-- 1) Public bucket: remove the listing policy (object URLs still work)
drop policy if exists "avatars public read" on storage.objects;

-- 2) Revoke EXECUTE from anon on all flagged functions
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.reset_monthly_usage() from anon;
revoke execute on function public.grant_trial(uuid) from anon;
revoke execute on function public.increment_api_usage(uuid) from anon;
revoke execute on function public.decrement_stock(uuid, integer) from anon;
revoke execute on function public.recompute_customer_stats(uuid) from anon;
revoke execute on function public.recompute_supplier_outstanding(uuid) from anon;
revoke execute on function public.sync_campaign_stats(uuid) from anon;
revoke execute on function public.update_onboarding_step(integer, jsonb) from anon;

-- 3) Trigger/cron-only DEFINER functions: drop the authenticated grant
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.reset_monthly_usage() from authenticated;

-- 4) Client/user-JWT functions: DEFINER -> INVOKER (RLS-enforced, no escalation)
alter function public.decrement_stock(uuid, integer) security invoker;
alter function public.increment_api_usage(uuid) security invoker;
alter function public.recompute_customer_stats(uuid) security invoker;
alter function public.recompute_supplier_outstanding(uuid) security invoker;
alter function public.update_onboarding_step(integer, jsonb) security invoker;
alter function public.grant_trial(uuid) security invoker;
alter function public.sync_campaign_stats(uuid) security invoker;

-- 5) Lock down PUBLIC execute (anon + authenticated inherit it) and re-grant
--    authenticated ONLY to the functions the client calls with a logged-in JWT.
--    Without this, `revoke from anon` alone is ineffective (anon inherits PUBLIC).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.reset_monthly_usage() from public;
revoke execute on function public.grant_trial(uuid) from public;
revoke execute on function public.increment_api_usage(uuid) from public;
revoke execute on function public.decrement_stock(uuid, integer) from public;
revoke execute on function public.recompute_customer_stats(uuid) from public;
revoke execute on function public.recompute_supplier_outstanding(uuid) from public;
revoke execute on function public.sync_campaign_stats(uuid) from public;
revoke execute on function public.update_onboarding_step(integer, jsonb) from public;

grant execute on function public.grant_trial(uuid) to authenticated;
grant execute on function public.increment_api_usage(uuid) to authenticated;
grant execute on function public.decrement_stock(uuid, integer) to authenticated;
grant execute on function public.recompute_customer_stats(uuid) to authenticated;
grant execute on function public.recompute_supplier_outstanding(uuid) to authenticated;
grant execute on function public.sync_campaign_stats(uuid) to authenticated;
grant execute on function public.update_onboarding_step(integer, jsonb) to authenticated;

-- >>> schema-v19.sql <<<
-- ════════════════════════════════════════════════════════════════
-- schema-v19 — Owner approval workflow (change requests + permission config)
-- Applied live to prwvaetatdidsugczluv. Safe to re-run.
--
-- Model: owner actions apply instantly. Manager/accountant money + add/remove
-- actions create a PENDING change_request the owner Approves/Denies from their
-- device. The owner's per-role permission_config controls which actions need
-- approval vs. are allowed directly.
-- ════════════════════════════════════════════════════════════════

-- Owner-editable permission config (per role → per money capability → mode)
alter table public.profiles add column if not exists permission_config jsonb not null default '{}'::jsonb;

-- Pending / decided change requests
create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,  -- shop owner who approves
  requester_id uuid references auth.users(id) on delete set null,           -- manager/accountant who asked
  requester_name text,
  requester_role text,
  capability text not null,        -- e.g. 'products:manage', 'sales:create'
  action_type text not null,       -- e.g. 'product.add', 'expense.create'
  target text,                     -- e.g. 'products'
  payload jsonb not null default '{}'::jsonb,
  summary text not null,           -- human-readable description of the change
  money_related boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_note text
);
create index if not exists change_requests_owner_idx on public.change_requests(owner_user_id, status, created_at desc);
create index if not exists change_requests_requester_idx on public.change_requests(requester_id, created_at desc);

alter table public.change_requests enable row level security;
-- Owner: full manage of requests addressed to them (read, approve=update, deny=delete)
drop policy if exists "Owner manages their change requests" on public.change_requests;
create policy "Owner manages their change requests" on public.change_requests
  for all using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
-- Requester: can create a request and read their own (cannot approve/deny)
drop policy if exists "Requester can create and read own" on public.change_requests;
create policy "Requester can create and read own" on public.change_requests
  for select using ((select auth.uid()) = requester_id);
drop policy if exists "Requester can insert" on public.change_requests;
create policy "Requester can insert" on public.change_requests
  for insert to authenticated with check ((select auth.uid()) = requester_id);

-- >>> schema-v20.sql <<<
-- ════════════════════════════════════════════════════════════════
-- schema-v20 — Security/hygiene linter fixes (new project)
-- Applied live to prwvaetatdidsugczluv. Safe to re-run.
-- ════════════════════════════════════════════════════════════════

-- 1) rls_enabled_no_policy (oauth_pending): it's a service-role-only PKCE store.
--    RLS stays enabled; this policy documents intent and satisfies the lint.
--    service_role bypasses RLS; client roles never match → denied.
drop policy if exists "service_role only" on public.oauth_pending;
create policy "service_role only" on public.oauth_pending
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- 2) function_search_path_mutable (set_updated_at): lock the search_path.
alter function public.set_updated_at() set search_path = public;

-- 3) anon + authenticated can execute SECURITY DEFINER log_integration_event.
--    Callers (integrations-api via user JWT, google-oauth via service role) pass
--    their own user_id, so RLS permits the audit insert → switch to INVOKER and
--    restrict EXECUTE to authenticated (clears both definer lints).
alter function public.log_integration_event(uuid, text, text, text, text, jsonb) security invoker;
revoke execute on function public.log_integration_event(uuid, text, text, text, text, jsonb) from public;
revoke execute on function public.log_integration_event(uuid, text, text, text, text, jsonb) from anon;
grant execute on function public.log_integration_event(uuid, text, text, text, text, jsonb) to authenticated;

-- >>> schema-v21.sql <<<
-- ════════════════════════════════════════════════════════════════
-- schema-v21 — Performance linter fixes (RLS initplan + FK indexes + unused indexes)
-- Applied live to prwvaetatdidsugczluv. Atomic (DO block rolls back on error).
-- ════════════════════════════════════════════════════════════════

-- 1) auth_rls_initplan (WARN, ~27 tables): replace bare auth.uid() with
--    (select auth.uid()) in every RLS policy expression so Postgres plans
--    it once per query instead of per row.
DO $$
DECLARE
  r RECORD;
  nq text;  -- new qual expression
  nc text;  -- new check expression
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, p.polname AS pol, p.polcmd,
           pg_get_expr(p.polqual, p.polrelid) AS q,
           pg_get_expr(p.polwithcheck, p.polrelid) AS c
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND (
        (pg_get_expr(p.polqual, p.polrelid) LIKE '%auth.uid()%' AND
         pg_get_expr(p.polqual, p.polrelid) NOT LIKE '%select auth.uid()%')
        OR
        (pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%auth.uid()%' AND
         pg_get_expr(p.polwithcheck, p.polrelid) NOT LIKE '%select auth.uid()%')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);

    nq := CASE WHEN r.q IS NOT NULL
      THEN replace(replace(r.q, 'auth.uid()', '(select auth.uid())'), '(select (select auth.uid()))', '(select auth.uid())')
      ELSE NULL END;
    nc := CASE WHEN r.c IS NOT NULL
      THEN replace(replace(r.c, 'auth.uid()', '(select auth.uid())'), '(select (select auth.uid()))', '(select auth.uid())')
      ELSE NULL END;

    IF r.polcmd = '*' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING %s WITH CHECK %s', r.pol, r.tbl, COALESCE(nq, 'true'), COALESCE(nc, 'true'));
    ELSIF r.polcmd = 'r' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT USING %s', r.pol, r.tbl, COALESCE(nq, 'true'));
    ELSIF r.polcmd = 'a' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK %s', r.pol, r.tbl, COALESCE(nc, 'true'));
    ELSIF r.polcmd = 'w' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE USING %s', r.pol, r.tbl, COALESCE(nq, 'true'));
    END IF;
  END LOOP;
END $$;

-- 2) unindexed_foreign_keys (INFO, 18 FKs): add covering indexes.
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_user_id ON public.campaign_recipients(user_id);
CREATE INDEX IF NOT EXISTS idx_data_entries_user_id ON public.data_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id ON public.email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_emails_user_id ON public.emails(user_id);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_user_id ON public.failed_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_audit_logs_user_id ON public.integration_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice_id ON public.invoice_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_user_id ON public.invoice_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON public.quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON public.reports(user_id);
CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON public.summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_member_user_id ON public.team_members(member_user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.transactions(customer_id);

-- 3) unused_index (INFO, 3): drop indexes that have never been used.
DROP INDEX IF EXISTS public.idx_corrections_user;
DROP INDEX IF EXISTS public.oauth_pending_user_id_idx;
DROP INDEX IF EXISTS public.change_requests_requester_idx;

-- >>> schema-v22.sql <<<
-- ════════════════════════════════════════════════════════════════
-- schema-v22 — Fix oauth_pending RLS + consolidate change_requests policies + FK indexes
-- Applied live to prwvaetatdidsugczluv.
-- ════════════════════════════════════════════════════════════════

-- 1) auth_rls_initplan (oauth_pending): wrap auth.role() in a subselect.
DROP POLICY IF EXISTS "service_role only" ON public.oauth_pending;
CREATE POLICY "service_role only" ON public.oauth_pending
  FOR ALL USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- 2) multiple_permissive_policies (change_requests): the FOR ALL owner policy
--    overlapped with the requester SELECT + INSERT policies for the same
--    role+action. Consolidate into exactly ONE policy per action.
DROP POLICY IF EXISTS "Owner manages their change requests" ON public.change_requests;
DROP POLICY IF EXISTS "Requester can create and read own" ON public.change_requests;
DROP POLICY IF EXISTS "Requester can insert" ON public.change_requests;

-- One SELECT policy (owner OR requester can read):
CREATE POLICY "Owner or requester can read" ON public.change_requests
  FOR SELECT TO authenticated USING ((select auth.uid()) = owner_user_id OR (select auth.uid()) = requester_id);
-- One INSERT policy (requester creates):
CREATE POLICY "Requester can insert" ON public.change_requests
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = requester_id);
-- One UPDATE policy (owner approves/denies):
CREATE POLICY "Owner can update" ON public.change_requests
  FOR UPDATE TO authenticated USING ((select auth.uid()) = owner_user_id);
-- One DELETE policy (owner denies = delete):
CREATE POLICY "Owner can delete" ON public.change_requests
  FOR DELETE TO authenticated USING ((select auth.uid()) = owner_user_id);

-- 3) unindexed_foreign_keys: add covering indexes for the 3 flagged FKs.
--    (These were dropped as "unused" in schema-v21 because the DB is empty —
--     but FK covering indexes are correct practice. They become "used" once
--     real data/traffic arrives. Keeping them is the right call.)
CREATE INDEX IF NOT EXISTS idx_ai_corrections_user_id ON public.ai_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_change_requests_requester_id ON public.change_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_oauth_pending_user_id ON public.oauth_pending(user_id);

-- >>> schema-v23.sql <<<
-- ════════════════════════════════════════════════════════════════
-- schema-v23 — Shared-business multi-user foundation
-- Enables team members (invited by the owner) to access the owner's
-- business data through team-aware RLS.
-- ════════════════════════════════════════════════════════════════

-- 1) Add business_owner_id to profiles (null for owners = they ARE the owner).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2) is_team_member(target_user_id) — SECURITY DEFINER so it can read team_members
--    (which has owner-only RLS). Returns true if the current user is the owner
--    OR an active team member of that owner.
CREATE OR REPLACE FUNCTION public.is_team_member(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (select auth.uid()) = target_user_id
    OR EXISTS (
      SELECT 1 FROM public.team_members
      WHERE user_id = target_user_id
        AND member_user_id = (select auth.uid())
        AND status = 'active'
    )
$$;

-- Revoke public execute (only roles that already have table access should call it).
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid) TO authenticated;

-- 3) Update RLS on ALL user_id-keyed tables to use is_team_member.
--    This makes team members' queries resolve: they can SEE and MANAGE the
--    owner's rows (the approval system handles what actions need owner sign-off).
--    profiles uses `id` not `user_id` — it stays as-is (each person manages
--    their own profile). oauth_pending + change_requests have custom policies.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, p.polname AS pol, p.polcmd,
           pg_get_expr(p.polqual, p.polrelid) AS q,
           pg_get_expr(p.polwithcheck, p.polrelid) AS chk
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname NOT IN ('profiles', 'oauth_pending', 'change_requests')
      AND (
        pg_get_expr(p.polqual, p.polrelid) LIKE '%user_id%'
        OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%user_id%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    IF r.polcmd = '*' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_team_member(user_id)) WITH CHECK (public.is_team_member(user_id))',
        r.pol, r.tbl
      );
    ELSIF r.polcmd = 'r' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (public.is_team_member(user_id))',
        r.pol, r.tbl
      );
    ELSIF r.polcmd = 'a' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_team_member(user_id))',
        r.pol, r.tbl
      );
    ELSIF r.polcmd = 'w' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_team_member(user_id))',
        r.pol, r.tbl
      );
    END IF;
  END LOOP;
END $$;

-- >>> schema-v24.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v24 — POS upgrades (New Sale screen)
--   • held_carts        — park / resume a sale mid-shift
--   • sale_payments     — split-payment tender lines per sale
--   • transactions      — 'split' payment method, discount_reason,
--                         void_reason / voided_at / voided_by
--   • products.units    — multi-unit pricing (piece / kg / dozen …)
--   • cash_sessions     — end-of-day cash reconciliation
--   • adjust_stock()    — stock decrement that accepts fractional
--                         base units (e.g. 0.5 kg)
-- All additive. Nothing renamed or removed. Owner-scoped RLS on
-- every new table (same pattern as khata_entries).
-- NOTE: products.stock_quantity widens int → numeric (lossless) so
--   multi-unit sales (500g of a kg-tracked SKU) decrement exactly.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Held carts (park a sale, resume later) ───────────────────
create table if not exists public.held_carts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text,
  cart       jsonb not null,
  total      numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.held_carts enable row level security;

drop policy if exists "Owner can manage held carts" on public.held_carts;
create policy "Owner can manage held carts" on public.held_carts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_held_carts_user
  on public.held_carts (user_id, created_at desc);

-- ── 2. Split-payment tender lines ───────────────────────────────
create table if not exists public.sale_payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  method         text not null check (method in ('cash','card','upi','wallet','other')),
  amount         numeric not null check (amount > 0),
  reference      text,
  created_at     timestamptz not null default now()
);

alter table public.sale_payments enable row level security;

drop policy if exists "Owner can manage sale payments" on public.sale_payments;
create policy "Owner can manage sale payments" on public.sale_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_sale_payments_user
  on public.sale_payments (user_id, created_at desc);
create index if not exists idx_sale_payments_txn
  on public.sale_payments (transaction_id);

-- Multi-tender sales record 'split' on the transaction itself.
alter table public.transactions
  drop constraint if exists transactions_payment_method_check;
alter table public.transactions
  add constraint transactions_payment_method_check
  check (payment_method in ('cash','card','upi','wallet','other','split'));

-- ── 3. Discount reason (cart-level; line notes live in items jsonb)
alter table public.transactions
  add column if not exists discount_reason text;

-- ── 4. Void / return audit fields ───────────────────────────────
alter table public.transactions
  add column if not exists void_reason text;
alter table public.transactions
  add column if not exists voided_at timestamptz;
alter table public.transactions
  add column if not exists voided_by text;

-- ── 5. Multi-unit pricing (per-piece / per-kg / per-dozen) ──────
alter table public.products
  add column if not exists units jsonb;

-- Base stock must hold fractional amounts (e.g. 24.5 kg) once a SKU
-- sells in partial base units. int → numeric is lossless.
alter table public.products
  alter column stock_quantity type numeric;

-- ── 6. End-of-day cash reconciliation ───────────────────────────
create table if not exists public.cash_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_date  date not null default current_date,
  expected_cash numeric not null default 0,
  counted_cash  numeric not null default 0,
  variance      numeric generated always as (counted_cash - expected_cash) stored,
  notes         text,
  created_at    timestamptz not null default now()
);

alter table public.cash_sessions enable row level security;

drop policy if exists "Owner can manage cash sessions" on public.cash_sessions;
create policy "Owner can manage cash sessions" on public.cash_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create unique index if not exists idx_cash_sessions_user_date
  on public.cash_sessions (user_id, session_date);

-- ── 7. Stock adjustment accepting fractional base units ─────────
-- Same semantics as decrement_stock, numeric qty. decrement_stock
-- is kept untouched for existing callers.
create or replace function public.adjust_stock(p_id uuid, qty numeric)
returns void
language sql
set search_path = 'public'
as $function$
  update public.products
  set stock_quantity = greatest(0, stock_quantity - qty),
      updated_at = now()
  where id = p_id;
$function$;

grant execute on function public.adjust_stock(uuid, numeric) to authenticated;

-- >>> schema-v25.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v25 — recurring invoices + auto-overdue + category hygiene
--
--   • recurring_invoices   — weekly / monthly / yearly billing with
--                            start/end dates, next-invoice date,
--                            pause/resume, dedup-safe generation
--   • invoices             — recurring linkage (recurring_id,
--                            recurring_period) + unique indexes that
--                            make duplicate generation impossible
--   • mark_overdue_invoices()      — scheduled: unpaid → overdue
--   • generate_recurring_invoices() — scheduled: creates invoices,
--                            never twice for the same period
--   • products.category    — one-time case-insensitive merge
-- All additive. Owner-scoped RLS on the new table.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Recurring invoices ───────────────────────────────────────
create table if not exists public.recurring_invoices (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  customer_id      uuid references public.customers(id) on delete set null,
  client_name      text not null,
  client_email     text,
  client_phone     text,
  client_address   text,
  items            jsonb not null default '[]',
  tax_rate         numeric not null default 0,
  frequency        text not null check (frequency in ('weekly','monthly','yearly')),
  start_date       date not null default current_date,
  end_date         date,
  next_invoice_date date not null,
  status           text not null default 'active' check (status in ('active','paused','ended')),
  notes            text,
  last_period      date,
  last_generated_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.recurring_invoices enable row level security;

drop policy if exists "Owner can manage recurring invoices" on public.recurring_invoices;
create policy "Owner can manage recurring invoices" on public.recurring_invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_recurring_user_status
  on public.recurring_invoices (user_id, status, next_invoice_date);

-- ── 2. Invoices: recurring linkage + hard dedup guarantees ──────
alter table public.invoices
  add column if not exists recurring_id uuid
    references public.recurring_invoices(id) on delete set null;
alter table public.invoices
  add column if not exists recurring_period date;

-- One invoice per recurring profile per period — the DB itself
-- refuses duplicates even if the job ever runs twice concurrently.
create unique index if not exists idx_invoices_recurring_period
  on public.invoices (recurring_id, recurring_period)
  where recurring_id is not null;

-- No two invoices of the same business may share a number
-- (verified: no duplicates exist in current data).
create unique index if not exists idx_invoices_user_number
  on public.invoices (user_id, invoice_number);

-- Widen the status check to the vocabulary the app already uses
-- (dashboard + invoice pages expect 'viewed' and 'partial').
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('draft','sent','viewed','partial','paid','overdue'));

-- ── 3. Auto-overdue: unpaid invoices past their due date ────────
create or replace function public.mark_overdue_invoices()
returns integer
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  changed integer;
begin
  update public.invoices
  set status = 'overdue', updated_at = now()
  where status in ('sent','viewed','partial')
    and due_date is not null
    and due_date < current_date;
  get diagnostics changed = row_count;
  return changed;
end
$function$;

-- ── 4. Recurring generation — atomic claim, duplicate-proof ─────
-- Rows are locked (FOR UPDATE SKIP LOCKED), claimed by advancing
-- next_invoice_date and stamping last_period, then one invoice is
-- inserted per claimed profile for exactly that period. The unique
-- indexes above are the backstop.
create or replace function public.generate_recurring_invoices()
returns integer
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  made integer;
begin
  with candidates as (
    select id
    from public.recurring_invoices
    where status = 'active'
      and next_invoice_date <= current_date
      and (end_date is null or next_invoice_date <= end_date)
    order by next_invoice_date
    limit 500
    for update skip locked
  ),
  claimed as (
    update public.recurring_invoices r
    set last_period = r.next_invoice_date,
        next_invoice_date = case r.frequency
          when 'weekly'  then r.next_invoice_date + 7
          when 'yearly'  then (r.next_invoice_date + interval '1 year')::date
          else                (r.next_invoice_date + interval '1 month')::date
        end,
        status = case
          when r.end_date is not null and (
            case r.frequency
              when 'weekly'  then r.next_invoice_date + 7
              when 'yearly'  then (r.next_invoice_date + interval '1 year')::date
              else                (r.next_invoice_date + interval '1 month')::date
            end
          ) > r.end_date then 'ended'
          else r.status
        end,
        last_generated_at = now(),
        updated_at = now()
    from candidates c
    where r.id = c.id
    returning r.id, r.user_id, r.client_name, r.client_email, r.client_phone,
              r.client_address, r.items, r.tax_rate, r.last_period
  ),
  inserted as (
    insert into public.invoices (
      user_id, invoice_number, client_name, client_email, client_phone,
      client_address, items, subtotal, tax_rate, tax_amount, total,
      status, due_date, notes, recurring_id, recurring_period, created_at, updated_at
    )
    select
      c.user_id,
      'INV-' || to_char(c.last_period, 'YYMMDD') || '-' || substr(md5(c.id::text || c.last_period::text), 1, 4),
      c.client_name, c.client_email, c.client_phone, c.client_address,
      c.items,
      t.subtotal,
      c.tax_rate,
      round(t.subtotal * c.tax_rate / 100.0, 2),
      round(t.subtotal * (1 + c.tax_rate / 100.0), 2),
      'sent',
      c.last_period + 7,
      'Auto-generated recurring invoice',
      c.id,
      c.last_period,
      now(), now()
    from claimed c
    cross join lateral (
      select coalesce(sum((it->>'quantity')::numeric * (it->>'unit_price')::numeric), 0) as subtotal
      from jsonb_array_elements(c.items) as it
    ) t
    on conflict do nothing
    returning 1
  )
  select count(*) into made from inserted;
  return made;
end
$function$;

-- ── 5. Category hygiene — merge case-variant spellings ──────────
-- "Electronics" / "electronics" become one category (most common
-- spelling wins). Idempotent: running it again changes nothing.
update public.products p
set category = c.canonical
from (
  select lower(category) as key,
         (array_agg(category order by cnt desc, category asc))[1] as canonical
  from (
    select category, count(*) as cnt
    from public.products
    group by category
  ) s
  group by lower(category)
) c
where lower(p.category) = c.key
  and p.category <> c.canonical;

-- ── 6. Schedules (IST) ──────────────────────────────────────────
-- 06:15 IST — mark overdue invoices
select cron.schedule('mark-overdue-invoices', '15 0 * * *', $$select public.mark_overdue_invoices();$$);
-- 06:30 IST — generate due recurring invoices
select cron.schedule('generate-recurring-invoices', '30 0 * * *', $$select public.generate_recurring_invoices();$$);

-- ── v25.1: buyer GSTIN for B2B tax invoices (Rule 46(h)) ────────
alter table public.invoices add column if not exists client_gstin text;

-- >>> schema-v26.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v26 — profit/bank/GST toolkit (corrected from PR #3)
--   • bank_transactions  — imported bank statement rows, owner-only
--                          RLS (the PR's draft had NO RLS = leak)
--   • customers.credit_limit, suppliers.credit_limit
-- Customer udhaar stays in khata_entries (the real system) — no
-- duplicate "outstanding" column. Invoices already carry tax_rate /
-- tax_amount / hsn_summary — no redundant gst_rate/gst_amount.
-- The PR's draft RPCs referenced non-existent tables (payments,
-- invoices.supplier_id, invoices.total_amount) and were dropped.
-- ════════════════════════════════════════════════════════════════

create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  transaction_date date not null,
  amount numeric(12,2) not null,
  description text,
  matched boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.bank_transactions enable row level security;

drop policy if exists "Owner can manage bank transactions" on public.bank_transactions;
create policy "Owner can manage bank transactions" on public.bank_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_bank_txn_user on public.bank_transactions (user_id, transaction_date desc);
create index if not exists idx_bank_txn_invoice on public.bank_transactions (invoice_id);

alter table public.customers add column if not exists credit_limit numeric(12,2) not null default 0;
alter table public.suppliers add column if not exists credit_limit numeric(12,2) not null default 0;

-- >>> schema-v27.sql <<<
-- ════════════════════════════════════════════════════════════════
-- Schema v27 — production integrity, auth isolation and POS atomicity
--
-- Apply after schema-v26 (or use the matching section appended to
-- _combined-schema.sql). This migration is intentionally idempotent.
-- It fixes the contracts used by the current UI and makes a checkout / void
-- one database transaction instead of a chain of independent writes.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Columns consumed by GST, invoice, inventory and audit code ──
-- The live edge functions use Groq as the fast Meraj/STT provider. The old
-- constraint pre-dates that provider and makes team-link/profile creation fail.
alter table public.profiles drop constraint if exists profiles_ai_provider_check;
alter table public.profiles add constraint profiles_ai_provider_check
  check (ai_provider in ('openai','gemini','anthropic','vercel_gateway','openrouter','groq'));

alter table public.products add column if not exists hsn_code text;
alter table public.products add column if not exists gst_rate numeric(5,2) not null default 0;
alter table public.products drop constraint if exists products_gst_rate_check;
alter table public.products add constraint products_gst_rate_check check (gst_rate between 0 and 100);
alter table public.products alter column stock_quantity type numeric using stock_quantity::numeric;

alter table public.invoices add column if not exists client_phone text;
alter table public.invoices add column if not exists client_gstin text;
alter table public.invoices add column if not exists upi_id text;
alter table public.invoices add column if not exists payment_link text;
alter table public.invoices add column if not exists paid_at timestamptz;
alter table public.invoices add column if not exists reminder_count integer not null default 0;
alter table public.invoices add column if not exists last_reminder_at timestamptz;
alter table public.invoices add column if not exists reminder_claimed_at timestamptz;
alter table public.invoices add column if not exists reminder_claim_id uuid;
alter table public.invoices add column if not exists is_interstate boolean not null default false;
alter table public.invoices add column if not exists place_of_supply text;
alter table public.invoices add column if not exists hsn_summary jsonb not null default '[]'::jsonb;

-- Daily report delivery is claimed separately from report generation. The
-- timestamp lets a dead worker be recovered without allowing two live cron
-- invocations to send the same report concurrently.
alter table public.daily_reports add column if not exists report_claimed_at timestamptz;
alter table public.daily_reports add column if not exists report_claim_id uuid;
create index if not exists idx_daily_reports_claim on public.daily_reports(status, report_claimed_at);

alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('draft','sent','viewed','partial','paid','overdue'));

-- Campaigns need explicit run/recipient state so a timed-out edge function is
-- recoverable without re-sending an email that another invocation already
-- claimed. A stale run may be taken over by the service role after the bounded
-- heartbeat window; the run id prevents the old invocation from finalizing it.
alter table public.email_campaigns add column if not exists send_run_id uuid;
alter table public.email_campaigns add column if not exists send_started_at timestamptz;
alter table public.email_campaigns add column if not exists send_heartbeat_at timestamptz;
alter table public.email_campaigns add column if not exists last_error text;
alter table public.email_campaigns drop constraint if exists email_campaigns_status_check;
alter table public.email_campaigns add constraint email_campaigns_status_check
  check (status in ('draft','scheduled','sending','sent','partial','failed','paused'));
alter table public.campaign_recipients add column if not exists attempt_count integer not null default 0;
alter table public.campaign_recipients add column if not exists processing_run_id uuid;
alter table public.campaign_recipients add column if not exists processing_at timestamptz;
alter table public.campaign_recipients add column if not exists last_error text;
alter table public.campaign_recipients drop constraint if exists campaign_recipients_status_check;
alter table public.campaign_recipients add constraint campaign_recipients_status_check
  check (status in ('pending','processing','generated','failed','sent','opened','clicked','replied','bounced'));
create index if not exists idx_campaign_send_heartbeat on public.email_campaigns(status, send_heartbeat_at);
create index if not exists idx_campaign_recipient_processing on public.campaign_recipients(campaign_id, status, processing_at);

-- The legacy integration row is retained for non-secret metadata and backward
-- compatibility, but its JSON must never be a token vault.
alter table public.integrations drop constraint if exists integrations_provider_check;
alter table public.integrations drop constraint if exists integrations_provider_check1;
alter table public.integrations add constraint integrations_provider_check
  check (provider in ('gmail','google_sheets','google_drive','manual','whatsapp','shopify','razorpay','tally','excel'));

-- A real khata table was referenced by the UI but absent from the versioned
-- schema. Keep it deliberately small and auditable.
create table if not exists public.khata_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  amount numeric(12,2) not null check (amount > 0),
  note text,
  status text not null default 'pending' check (status in ('pending','settled')),
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.khata_entries enable row level security;
create index if not exists idx_khata_entries_user_created on public.khata_entries(user_id, created_at desc);

-- Support requests are kept as a small server-side audit/rate-limit ledger.
-- The message body is intentionally not stored here; delivery providers receive
-- it only for the request the signed-in user submitted.
create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  subject text not null,
  created_at timestamptz not null default now()
);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from anon, authenticated;
grant all on public.support_requests to service_role;
create index if not exists idx_support_requests_user_created on public.support_requests(user_id, created_at desc);

-- OAuth state needs to carry the selected permission level. It is service-role
-- only and is consumed once by the callback.
alter table public.oauth_pending add column if not exists permission_mode text not null default 'read_only';
alter table public.oauth_pending add column if not exists expires_at timestamptz;
create index if not exists idx_oauth_pending_expires on public.oauth_pending(expires_at);

-- Held carts need an actor id so a cashier can clean up only carts they
-- parked; the owner can still review/delete every cart in the business.
alter table public.held_carts
  add column if not exists created_by uuid references auth.users(id) on delete set null;
update public.held_carts
set created_by = user_id
where created_by is null;
create index if not exists idx_held_carts_created_by
  on public.held_carts (created_by, created_at desc);

-- Meta may retry an authenticated webhook notification. Provider message ids
-- are unique, while null ids remain allowed for unusual system callbacks. Remove
-- only duplicate provider callbacks before enforcing that invariant; the newest
-- copy is retained for audit history.
delete from public.whatsapp_messages older
using public.whatsapp_messages newer
where older.wa_message_id is not null
  and older.wa_message_id = newer.wa_message_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);
create unique index if not exists whatsapp_messages_wa_id_unique
  on public.whatsapp_messages (wa_message_id)
  where wa_message_id is not null;

-- ── 2. Replace user-id policies consistently ────────────────────
-- Team members may work on business records; credentials, billing, team
-- administration and bank data remain owner-only.
do $$
declare
  r record;
  tbl text;
  team_tables text[] := array[
    'invoices','reports','data_entries','summaries','activity_logs',
    'email_campaigns','campaign_recipients','products','customers',
    'transactions','suppliers','purchase_orders','quotations','expenses',
    'business_memory','ai_predictions','ai_corrections','invoice_reminders',
    'daily_reports','failed_jobs','whatsapp_messages','held_carts',
    'sale_payments','cash_sessions','recurring_invoices','khata_entries'
  ];
  owner_tables text[] := array[
    'subscriptions','api_keys','integrations','connected_apps',
    'integration_audit_logs','bank_transactions','team_members'
  ];
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
             and (tablename = any(team_tables) or tablename = any(owner_tables))
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;

  foreach tbl in array team_tables loop
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.is_team_member(user_id))) with check ((select public.is_team_member(user_id)))',
      'Team can manage ' || tbl, tbl
    );
  end loop;

  foreach tbl in array owner_tables loop
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      'Owner can manage ' || tbl, tbl
    );
  end loop;
end $$;

-- Khata was created above, so ensure its policy exists even if the defensive
-- DO block encountered an older missing optional table.
drop policy if exists "Team can manage khata_entries" on public.khata_entries;
create policy "Team can manage khata_entries" on public.khata_entries
  for all to authenticated
  using ((select public.is_team_member(user_id)))
  with check ((select public.is_team_member(user_id)));

-- Profiles are private to each person. Do not allow a browser client to turn
-- itself into an owner of another business or change its role.
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.protect_profile_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (select auth.role()) <> 'service_role' then
    -- A browser may edit profile/contact preferences only. Membership and
    -- entitlements are server-owned; without these assignments a user could
    -- self-upgrade, reset usage, or turn into the owner of another business.
    new.business_owner_id := old.business_owner_id;
    new.role := old.role;
    new.plan := old.plan;
    new.plan_tier := old.plan_tier;
    new.trial_ends_at := old.trial_ends_at;
    new.api_usage_limit := old.api_usage_limit;
    new.api_usage_count := old.api_usage_count;
  end if;
  return new;
end;
$function$;
drop trigger if exists protect_profile_membership on public.profiles;
create trigger protect_profile_membership
  before update on public.profiles
  for each row execute function public.protect_profile_membership();
revoke execute on function public.protect_profile_membership() from public, anon, authenticated;

-- Secrets are not browser-readable. The status page uses the explicit safe
-- column list below; service-role edge functions retain full access.
revoke all on public.connected_apps from anon, authenticated;
grant select (id, user_id, app_slug, app_name, provider_account_id, provider_email,
  permission_mode, scopes_granted, status, last_synced_at, metadata, created_at, updated_at)
  on public.connected_apps to authenticated;
grant all on public.connected_apps to service_role;

-- Remove tokens that may have been written by pre-v27 OAuth code, while
-- preserving harmless connection metadata. Copying to connected_apps first
-- makes this safe for an existing installation.
insert into public.connected_apps as ca (
  user_id, app_slug, app_name, provider_email, permission_mode,
  access_token, refresh_token, token_expires_at, scopes_granted, status,
  last_synced_at, metadata
)
select
  i.user_id,
  case when i.provider = 'google_sheets' then 'google-sheets'
       when i.provider = 'google_drive' then 'google-drive'
       else i.provider end,
  case when i.provider = 'google_sheets' then 'Google Sheets'
       when i.provider = 'google_drive' then 'Google Drive'
       when i.provider = 'gmail' then 'Gmail'
       else coalesce(i.label, i.provider) end,
  i.metadata->>'connected_email',
  'read_only',
  i.metadata->>'access_token',
  i.metadata->>'refresh_token',
  case when (i.metadata->>'expires_at') ~ '^[0-9]+$'
       then to_timestamp((i.metadata->>'expires_at')::numeric / 1000.0)
       else null end,
  case when coalesce(i.metadata->>'scope','') = '' then null
       else string_to_array(i.metadata->>'scope', ' ') end,
  case when i.status = 'connected' then 'connected' else 'disconnected' end,
  i.last_synced_at,
  (i.metadata - 'access_token' - 'refresh_token' - 'expires_at')
from public.integrations i
where i.provider in ('gmail','google_sheets','google_drive')
  and (i.metadata ? 'access_token' or i.metadata ? 'refresh_token')
on conflict (user_id, app_slug) do update set
  access_token = coalesce(ca.access_token, excluded.access_token),
  refresh_token = coalesce(ca.refresh_token, excluded.refresh_token),
  token_expires_at = coalesce(ca.token_expires_at, excluded.token_expires_at),
  updated_at = now();

update public.integrations
set metadata = metadata - 'access_token' - 'refresh_token' - 'expires_at'
where metadata ? 'access_token' or metadata ? 'refresh_token' or metadata ? 'expires_at';

-- ── 2a. Fail-closed business identity helpers ──────────────────
-- A nullable business_owner_id is not sufficient to prove that a profile is
-- an owner: a revoked linked account also has a null mapping. Every tenant
-- helper therefore requires an owner profile, and every member mapping must
-- agree with both the team row and the member profile.
create or replace function public.is_business_owner(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and p.role = 'owner'
      and p.business_owner_id is null
  )
$function$;
revoke execute on function public.is_business_owner(uuid) from public, anon;
grant execute on function public.is_business_owner(uuid) to authenticated;

create or replace function public.is_team_member(target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.profiles owner_profile
    where owner_profile.id = target_user_id
      and owner_profile.role = 'owner'
      and owner_profile.business_owner_id is null
      and owner_profile.id = (select auth.uid())
  )
  or exists (
    select 1
    from public.team_members tm
    join public.profiles owner_profile
      on owner_profile.id = tm.user_id
     and owner_profile.role = 'owner'
     and owner_profile.business_owner_id is null
    join public.profiles member_profile
      on member_profile.id = tm.member_user_id
     and member_profile.business_owner_id = tm.user_id
     and member_profile.role = tm.role
    where tm.user_id = target_user_id
      and tm.member_user_id = (select auth.uid())
      and tm.status = 'active'
  )
$function$;
revoke execute on function public.is_team_member(uuid) from public, anon;
grant execute on function public.is_team_member(uuid) to authenticated;

-- ── 3. Atomic POS checkout ─────────────────────────────────────
-- Resolve the authenticated actor's role without exposing team_members through
-- RLS. Used only by trusted business RPCs; it never accepts a role from JSON.
create or replace function public.can_direct_capability(p_owner_id uuid, p_capability text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  member_role text;
  owner_config jsonb;
begin
  -- A caller-controlled owner id must resolve to a real owner profile. This
  -- prevents an orphaned/revoked staff profile from treating itself as a
  -- business owner by passing its own uuid.
  if not public.is_business_owner(p_owner_id) then return false; end if;
  if (select auth.uid()) = p_owner_id then return true; end if;
  select tm.role, owner.permission_config into member_role, owner_config
    from public.team_members tm
    join public.profiles owner
      on owner.id = tm.user_id
     and owner.role = 'owner'
     and owner.business_owner_id is null
    join public.profiles member
      on member.id = tm.member_user_id
     and member.business_owner_id = tm.user_id
     and member.role = tm.role
    where tm.user_id = p_owner_id and tm.member_user_id = (select auth.uid()) and tm.status = 'active'
    limit 1;
  if member_role is null then return false; end if;
  if member_role = 'staff' and p_capability = 'sales:create' then return true; end if;
  -- These non-money surfaces are intentionally direct for managers; they are
  -- still limited to an authenticated active member of this exact business.
  if member_role = 'manager' and p_capability in ('customers:manage', 'campaigns:manage') then return true; end if;
  return coalesce(owner_config #>> array[member_role, p_capability], '') = 'direct';
end;
$function$;
revoke execute on function public.can_direct_capability(uuid,text) from public, anon;
grant execute on function public.can_direct_capability(uuid,text) to authenticated;

-- POS may create a customer while a sale is being rung up. Editing or deleting
-- the CRM remains owner/manager-only; staff cannot use the counter shortcut to
-- erase or rewrite customer history.
create or replace function public.can_create_customer(p_owner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $function$
  select public.is_business_owner(p_owner_id)
    and (
      (select auth.uid()) = p_owner_id
      or exists (
        select 1 from public.team_members tm
        join public.profiles member
          on member.id = tm.member_user_id
         and member.business_owner_id = tm.user_id
         and member.role = tm.role
        where tm.user_id = p_owner_id and tm.member_user_id = (select auth.uid())
          and tm.status = 'active' and tm.role in ('manager','staff')
      )
    )
$function$;
revoke execute on function public.can_create_customer(uuid) from public, anon;
grant execute on function public.can_create_customer(uuid) to authenticated;

create or replace function public.can_manage_customer(p_owner_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $function$
  select public.is_business_owner(p_owner_id)
    and (
      (select auth.uid()) = p_owner_id
      or exists (
        select 1 from public.team_members tm
        join public.profiles member
          on member.id = tm.member_user_id
         and member.business_owner_id = tm.user_id
         and member.role = tm.role
        where tm.user_id = p_owner_id and tm.member_user_id = (select auth.uid())
          and tm.status = 'active' and tm.role = 'manager'
      )
    )
$function$;
revoke execute on function public.can_manage_customer(uuid) from public, anon;
grant execute on function public.can_manage_customer(uuid) to authenticated;

-- Onboarding mutates the business owner's profile only. Keep the original RPC
-- signature so existing clients continue to work, but fail closed for linked or
-- revoked accounts and validate the report settings server-side.
create or replace function public.update_onboarding_step(step integer, data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  next_phone text;
  next_time text;
begin
  if (select auth.uid()) is null or not public.is_business_owner((select auth.uid())) then
    raise exception 'Only the business owner can complete onboarding';
  end if;
  if data is null then data := '{}'::jsonb; end if;
  if step = 1 then
    if nullif(trim(coalesce(data->>'shop_category','')), '') is null
       or length(data->>'shop_category') > 120 then
      raise exception 'A valid shop category is required';
    end if;
    update public.profiles
    set shop_category = left(trim(data->>'shop_category'), 120),
        onboarding_step = greatest(onboarding_step, 2), updated_at = now()
    where id = (select auth.uid());
  elsif step = 2 then
    update public.profiles
    set onboarding_step = greatest(onboarding_step, 3), updated_at = now()
    where id = (select auth.uid());
  elsif step = 3 then
    next_phone := nullif(trim(data->>'whatsapp_number'), '');
    next_time := coalesce(nullif(trim(data->>'report_time_utc'), ''), '17:00');
    if next_phone is not null and next_phone !~ '^\+?[0-9 ()-]{7,24}$' then
      raise exception 'WhatsApp number is invalid';
    end if;
    if next_time !~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Report time is invalid';
    end if;
    update public.profiles
    set whatsapp_number = next_phone, report_time_utc = next_time,
        onboarding_step = greatest(onboarding_step, 4), updated_at = now()
    where id = (select auth.uid());
  else
    raise exception 'Unknown onboarding step';
  end if;
end;
$function$;
revoke execute on function public.update_onboarding_step(integer,jsonb) from public, anon;
grant execute on function public.update_onboarding_step(integer,jsonb) to authenticated;

-- The first policy pass runs before the identity helpers are declared. Replace
-- the owner-table policies now that the fail-closed owner predicate exists;
-- otherwise a linked user could create orphan credentials under their own id.
do $$
declare
  r record;
  tbl text;
begin
  for r in select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array['api_keys','integrations','connected_apps','bank_transactions'])
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
  foreach tbl in array array['api_keys','integrations','connected_apps','bank_transactions'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id))) with check ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)))',
      'Owner can manage ' || tbl, tbl
    );
  end loop;
end $$;

-- Owner restock is an additive, row-locked mutation. A client must never
-- calculate `current stock + quantity` and send the resulting absolute value.
create or replace function public.restock_product(
  p_product_id uuid,
  p_owner_id uuid,
  p_add_quantity numeric,
  p_price numeric default null,
  p_cost numeric default null
)
returns public.products
language plpgsql
security definer
set search_path = public
as $function$
declare
  product_row public.products%rowtype;
begin
  if (select auth.role()) <> 'service_role'
     and ((select auth.uid()) is null or (select auth.uid()) <> p_owner_id) then
    raise exception 'Only the business owner can restock this product';
  end if;
  if not public.is_business_owner(p_owner_id) then
    raise exception 'Product owner is not a valid business owner';
  end if;
  if p_product_id is null or p_add_quantity is null
     or lower(p_add_quantity::text) in ('nan','infinity','-infinity')
     or p_add_quantity <= 0 or p_add_quantity > 1000000000 then
    raise exception 'Restock quantity must be positive and reasonable';
  end if;
  if p_price is not null and (
       lower(p_price::text) in ('nan','infinity','-infinity')
       or p_price < 0 or p_price > 1000000000
     ) then
    raise exception 'Product price is invalid';
  end if;
  if p_cost is not null and (
       lower(p_cost::text) in ('nan','infinity','-infinity')
       or p_cost < 0 or p_cost > 1000000000
     ) then
    raise exception 'Product cost is invalid';
  end if;

  select * into product_row
    from public.products
    where id = p_product_id and user_id = p_owner_id
    for update;
  if not found then raise exception 'Product not found in this business'; end if;
  if product_row.stock_quantity is null
     or lower(product_row.stock_quantity::text) in ('nan','infinity','-infinity')
     or product_row.stock_quantity < 0 then
    raise exception 'Product stock is invalid';
  end if;

  update public.products
  set stock_quantity = stock_quantity + p_add_quantity,
      price = coalesce(p_price, price),
      cost = coalesce(p_cost, cost),
      updated_at = now()
  where id = p_product_id and user_id = p_owner_id
  returning * into product_row;
  return product_row;
end;
$function$;
revoke execute on function public.restock_product(uuid,uuid,numeric,numeric,numeric) from public, anon;
grant execute on function public.restock_product(uuid,uuid,numeric,numeric,numeric) to authenticated;
grant execute on function public.restock_product(uuid,uuid,numeric,numeric,numeric) to service_role;

create or replace function public.complete_sale(
  p_transaction_id uuid,
  p_user_id uuid,
  p_customer_id uuid,
  p_receipt_number text,
  p_items jsonb,
  p_subtotal numeric,
  p_tax_rate numeric,
  p_tax_amount numeric,
  p_discount numeric,
  p_discount_reason text,
  p_total numeric,
  p_default_tax_rate numeric,
  p_payment_method text,
  p_payments jsonb,
  p_served_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  item jsonb;
  pay jsonb;
  unit_item jsonb;
  product_row public.products%rowtype;
  product_id uuid;
  quantity numeric;
  factor numeric;
  unit_price numeric;
  expected_price numeric;
  expected_factor numeric;
  gst_rate numeric;
  default_rate numeric := greatest(0, coalesce(p_default_tax_rate, 0));
  base numeric;
  effective_base numeric;
  line_discount numeric;
  subtotal_calc numeric := 0;
  line_discount_calc numeric := 0;
  pool numeric := 0;
  cart_discount numeric;
  cart_share numeric;
  taxable numeric;
  tax_calc numeric := 0;
  total_calc numeric;
  expected_rate numeric;
  payment_sum numeric := 0;
  consumed numeric;
  inserted_id uuid;
  affected integer;
  existing_user uuid;
  source text;
  max_amount numeric := 9999999999.99;
begin
  if auth.uid() is null or p_user_id is null or not public.can_direct_capability(p_user_id, 'sales:create') then
    raise exception 'Not authorised for this business';
  end if;
  if p_transaction_id is null or nullif(trim(p_receipt_number), '') is null then
    raise exception 'Transaction id and receipt number are required';
  end if;
  if length(trim(p_receipt_number)) > 100 then
    raise exception 'Receipt number is too long';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Sale items must be an array';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'A sale must contain at least one item';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'A sale cannot contain more than 200 lines';
  end if;
  if p_payments is null or jsonb_typeof(p_payments) <> 'array' then
    raise exception 'Payment lines must be an array';
  end if;
  if jsonb_array_length(p_payments) > 20 then
    raise exception 'A sale cannot contain more than 20 payment lines';
  end if;
  if p_subtotal is null or p_tax_rate is null or p_tax_amount is null
     or p_discount is null or p_total is null or p_default_tax_rate is null
     or lower(p_subtotal::text) in ('nan','infinity','-infinity')
     or lower(p_tax_rate::text) in ('nan','infinity','-infinity')
     or lower(p_tax_amount::text) in ('nan','infinity','-infinity')
     or lower(p_discount::text) in ('nan','infinity','-infinity')
     or lower(p_total::text) in ('nan','infinity','-infinity')
     or lower(p_default_tax_rate::text) in ('nan','infinity','-infinity')
     or p_subtotal < 0 or p_subtotal > max_amount
     or p_tax_rate < 0 or p_tax_rate > 100
     or p_tax_amount < 0 or p_tax_amount > max_amount
     or p_discount < 0 or p_discount > max_amount
     or p_total < 0 or p_total > max_amount
     or p_default_tax_rate < 0 or p_default_tax_rate > 100 then
    raise exception 'Sale amounts are invalid';
  end if;
  default_rate := round(p_default_tax_rate, 2);
  if length(coalesce(p_discount_reason, '')) > 500 then raise exception 'Discount reason is too long'; end if;
  if length(coalesce(p_served_by, '')) > 120 then raise exception 'Cashier name is too long'; end if;
  if p_payment_method is null or p_payment_method not in ('cash','card','upi','wallet','other','split') then
    raise exception 'Payment method is invalid';
  end if;

  -- Fast idempotency path. This also prevents a replay from touching stock a
  -- second time after a client timeout.
  select t.user_id into existing_user from public.transactions t where t.id = p_transaction_id;
  if found then
    if existing_user <> p_user_id then raise exception 'Transaction id belongs to another business'; end if;
    return jsonb_build_object('id', p_transaction_id, 'duplicate', true);
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers c where c.id = p_customer_id and c.user_id = p_user_id
  ) then
    raise exception 'Customer does not belong to this business';
  end if;

  -- Lock every SKU and validate the client payload against the current catalog
  -- before any write. A cashier cannot alter a price or sell concurrent stock.
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item) <> 'object'
       or item->>'product_id' is null
       or item->>'product_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or item->'quantity' is null or jsonb_typeof(item->'quantity') <> 'number'
       or item->'unit_price' is null or jsonb_typeof(item->'unit_price') <> 'number'
       or (item ? 'factor' and jsonb_typeof(item->'factor') not in ('number','null'))
       or (item ? 'gst_rate' and jsonb_typeof(item->'gst_rate') not in ('number','null'))
       or (item ? 'line_discount' and jsonb_typeof(item->'line_discount') not in ('number','null'))
       or (item ? 'unit' and (jsonb_typeof(item->'unit') not in ('string','null') or (jsonb_typeof(item->'unit') = 'string' and length(item->>'unit') > 64)))
       or (item ? 'gst_source' and jsonb_typeof(item->'gst_source') not in ('string','null'))
       or (item ? 'price_includes_tax' and jsonb_typeof(item->'price_includes_tax') not in ('boolean','null'))
       or (item ? 'line_discount_note' and (jsonb_typeof(item->'line_discount_note') not in ('string','null') or (jsonb_typeof(item->'line_discount_note') = 'string' and length(item->>'line_discount_note') > 500))) then
      raise exception 'Invalid sale line';
    end if;

    product_id := (item->>'product_id')::uuid;
    quantity := round((item->>'quantity')::numeric, 3);
    factor := round(coalesce((item->>'factor')::numeric, 1), 6);
    unit_price := round((item->>'unit_price')::numeric, 2);
    if lower(quantity::text) in ('nan','infinity','-infinity')
       or lower(factor::text) in ('nan','infinity','-infinity')
       or lower(unit_price::text) in ('nan','infinity','-infinity')
       or quantity <= 0 or quantity > 1000000
       or factor <= 0 or factor > 1000
       or unit_price < 0 or unit_price > max_amount then
      raise exception 'Invalid sale line';
    end if;

    select * into product_row
    from public.products
    where id = product_id and user_id = p_user_id and active = true
    for update;
    if not found then raise exception 'Product is unavailable'; end if;
    if product_row.price is null
       or lower(product_row.price::text) in ('nan','infinity','-infinity')
       or product_row.price < 0 or product_row.price > max_amount
       or product_row.stock_quantity is null
       or lower(product_row.stock_quantity::text) in ('nan','infinity','-infinity')
       or product_row.stock_quantity < 0
       or product_row.gst_rate is null
       or lower(product_row.gst_rate::text) in ('nan','infinity','-infinity')
       or product_row.gst_rate < 0 or product_row.gst_rate > 100 then
      raise exception 'Product catalog data is invalid';
    end if;

    if nullif(item->>'unit', '') is null then
      expected_price := round(product_row.price, 2);
      expected_factor := 1;
    else
      if product_row.units is not null and jsonb_typeof(product_row.units) <> 'array' then
        raise exception 'Product pricing data is invalid for %', product_row.name;
      end if;
      unit_item := null;
      select value into unit_item
      from jsonb_array_elements(coalesce(product_row.units, '[]'::jsonb))
      where value->>'unit' = item->>'unit'
      limit 1;
      if unit_item is null
         or jsonb_typeof(unit_item) <> 'object'
         or unit_item->'price' is null
         or jsonb_typeof(unit_item->'price') <> 'number'
         or (unit_item ? 'factor' and jsonb_typeof(unit_item->'factor') <> 'number') then
        raise exception 'Pricing unit is unavailable for %', product_row.name;
      end if;
      expected_price := round((unit_item->>'price')::numeric, 2);
      expected_factor := round(coalesce((unit_item->>'factor')::numeric, 1), 6);
      if lower(expected_price::text) in ('nan','infinity','-infinity')
         or lower(expected_factor::text) in ('nan','infinity','-infinity')
         or expected_price < 0 or expected_price > max_amount
         or expected_factor <= 0 or expected_factor > 1000 then
        raise exception 'Product pricing data is invalid for %', product_row.name;
      end if;
    end if;
    if unit_price <> expected_price or factor <> expected_factor then
      raise exception 'Price or unit changed for % — refresh the sale', product_row.name;
    end if;
    consumed := quantity * factor;
    if lower(consumed::text) in ('nan','infinity','-infinity') or consumed <= 0 or consumed > max_amount then
      raise exception 'Invalid sale quantity';
    end if;
    if product_row.stock_quantity < consumed then
      raise exception 'Insufficient stock for %', product_row.name;
    end if;

    source := coalesce(item->>'gst_source', 'manual');
    gst_rate := round(greatest(0, coalesce((item->>'gst_rate')::numeric, 0)), 2);
    if lower(gst_rate::text) in ('nan','infinity','-infinity') or gst_rate > 100 then raise exception 'GST rate is invalid'; end if;
    if source = 'product' and abs(gst_rate - coalesce(product_row.gst_rate, 0)) > 0.01 then
      raise exception 'GST rate changed for % — refresh the sale', product_row.name;
    elsif source = 'sale' and abs(gst_rate - default_rate) > 0.01 then
      raise exception 'Sale tax rate changed — refresh the sale';
    elsif source not in ('product','sale','manual') then
      raise exception 'GST source is invalid';
    end if;

    base := case when coalesce((item->>'price_includes_tax')::boolean, false) and gst_rate > 0
      then quantity * unit_price / (1 + gst_rate / 100)
      else quantity * unit_price end;
    line_discount := round(greatest(0, coalesce((item->>'line_discount')::numeric, 0)), 2);
    if lower(line_discount::text) in ('nan','infinity','-infinity')
       or line_discount < 0 or line_discount > max_amount
       or line_discount > base + 0.01 then
      raise exception 'Line discount is invalid';
    end if;
    line_discount := least(line_discount, round(base, 2));
    subtotal_calc := subtotal_calc + base;
    line_discount_calc := line_discount_calc + line_discount;
    pool := pool + greatest(0, base - line_discount);
    if subtotal_calc > max_amount or pool > max_amount then
      raise exception 'Sale is too large';
    end if;
  end loop;

  subtotal_calc := round(subtotal_calc, 2);
  line_discount_calc := round(line_discount_calc, 2);
  cart_discount := round(coalesce(p_discount, 0) - line_discount_calc, 2);
  if cart_discount < -0.01 or cart_discount > round(pool, 2) + 0.01 then
    raise exception 'Discount total is inconsistent';
  end if;
  cart_discount := greatest(0, least(cart_discount, round(pool, 2)));

  -- Recalculate tax and total from the locked catalog lines. Cart discount is
  -- allocated proportionally exactly as the browser's POS math does.
  for item in select value from jsonb_array_elements(p_items) loop
    product_id := (item->>'product_id')::uuid;
    quantity := round((item->>'quantity')::numeric, 3);
    factor := round(coalesce((item->>'factor')::numeric, 1), 6);
    unit_price := round((item->>'unit_price')::numeric, 2);
    select * into product_row from public.products where id = product_id and user_id = p_user_id;
    gst_rate := round(greatest(0, coalesce((item->>'gst_rate')::numeric, 0)), 2);
    line_discount := round(greatest(0, coalesce((item->>'line_discount')::numeric, 0)), 2);
    base := case when coalesce((item->>'price_includes_tax')::boolean, false) and gst_rate > 0
      then quantity * unit_price / (1 + gst_rate / 100)
      else quantity * unit_price end;
    effective_base := greatest(0, base - line_discount);
    cart_share := case when pool > 0 then round(cart_discount * effective_base / pool, 2) else 0 end;
    taxable := round(greatest(0, effective_base - cart_share), 2);
    tax_calc := tax_calc + round(taxable * gst_rate / 100, 2);
  end loop;
  tax_calc := round(tax_calc, 2);
  total_calc := round(pool - cart_discount + tax_calc, 2);
  if lower(tax_calc::text) in ('nan','infinity','-infinity')
     or lower(total_calc::text) in ('nan','infinity','-infinity')
     or tax_calc < 0 or tax_calc > max_amount
     or total_calc < 0 or total_calc > max_amount then
    raise exception 'Sale is too large';
  end if;
  expected_rate := case when round(pool - cart_discount, 2) > 0
    then round(tax_calc / round(pool - cart_discount, 2) * 100, 2) else 0 end;

  if abs(coalesce(p_subtotal, 0) - subtotal_calc) > 0.05
     or abs(coalesce(p_tax_amount, 0) - tax_calc) > 0.05
     or abs(coalesce(p_total, 0) - total_calc) > 0.05
     or abs(coalesce(p_tax_rate, 0) - expected_rate) > 0.15 then
    raise exception 'Sale totals changed — refresh the cart and try again';
  end if;

  for pay in select value from jsonb_array_elements(p_payments) loop
    if jsonb_typeof(pay) <> 'object'
       or pay->>'method' is null
       or jsonb_typeof(pay->'method') <> 'string'
       or pay->>'method' not in ('cash','card','upi','wallet','other')
       or pay->'amount' is null or jsonb_typeof(pay->'amount') <> 'number'
       or (pay ? 'reference' and (jsonb_typeof(pay->'reference') not in ('string','null') or (jsonb_typeof(pay->'reference') = 'string' and length(pay->>'reference') > 200))) then
      raise exception 'Tender line is invalid';
    end if;
    if lower(((pay->>'amount')::numeric)::text) in ('nan','infinity','-infinity')
       or (pay->>'amount')::numeric <= 0
       or (pay->>'amount')::numeric > max_amount then
      raise exception 'Tender amount must be positive and reasonable';
    end if;
    payment_sum := payment_sum + round((pay->>'amount')::numeric, 2);
    if payment_sum > max_amount then raise exception 'Tender total is too large'; end if;
  end loop;
  payment_sum := round(payment_sum, 2);
  if abs(payment_sum - total_calc) > 0.02 then raise exception 'Tender total does not match sale total'; end if;
  if total_calc > 0 and jsonb_array_length(p_payments) = 0 then raise exception 'A paid sale needs a tender'; end if;
  if p_payment_method = 'split' and jsonb_array_length(p_payments) < 2 then raise exception 'Split payment needs two tenders'; end if;
  if p_payment_method <> 'split' and jsonb_array_length(p_payments) > 1 then raise exception 'Use split payment for multiple tenders'; end if;
  if p_payment_method <> 'split' and jsonb_array_length(p_payments) = 1
     and (p_payments->0)->>'method' <> p_payment_method then
    raise exception 'Payment method does not match tender';
  end if;

  -- Store server-normalized line data, not a customer-controlled product name.
  declare normalized_items jsonb := '[]'::jsonb;
  begin
    for item in select value from jsonb_array_elements(p_items) loop
      product_id := (item->>'product_id')::uuid;
      quantity := round((item->>'quantity')::numeric, 3);
      factor := round(coalesce((item->>'factor')::numeric, 1), 6);
      unit_price := round((item->>'unit_price')::numeric, 2);
      gst_rate := round(greatest(0, coalesce((item->>'gst_rate')::numeric, 0)), 2);
      line_discount := round(greatest(0, coalesce((item->>'line_discount')::numeric, 0)), 2);
      select * into product_row from public.products where id = product_id and user_id = p_user_id;
      normalized_items := normalized_items || jsonb_build_array(jsonb_build_object(
        'product_id', product_id, 'name', product_row.name,
        'quantity', quantity, 'unit_price', unit_price,
        'unit', nullif(item->>'unit',''), 'factor', factor,
        'gst_rate', gst_rate, 'gst_source', coalesce(item->>'gst_source','manual'),
        'price_includes_tax', coalesce((item->>'price_includes_tax')::boolean,false),
        'line_discount', line_discount,
        'line_discount_note', nullif(item->>'line_discount_note','')
      ));
    end loop;

    insert into public.transactions (
      id, user_id, customer_id, receipt_number, items, subtotal, tax_rate,
      tax_amount, discount, discount_reason, total, payment_method, status,
      served_by
    ) values (
      p_transaction_id, p_user_id, p_customer_id, trim(p_receipt_number), normalized_items,
      subtotal_calc, expected_rate, tax_calc, round(line_discount_calc + cart_discount, 2),
      nullif(trim(coalesce(p_discount_reason,'')), ''), total_calc,
      p_payment_method, 'completed', nullif(trim(coalesce(p_served_by,'')), '')
    ) on conflict (id) do nothing returning id into inserted_id;
  end;

  if inserted_id is null then
    select user_id into existing_user from public.transactions where id = p_transaction_id;
    if existing_user <> p_user_id then raise exception 'Transaction id belongs to another business'; end if;
    return jsonb_build_object('id', p_transaction_id, 'duplicate', true);
  end if;

  for pay in select value from jsonb_array_elements(p_payments) loop
    insert into public.sale_payments (user_id, transaction_id, method, amount, reference)
    values (p_user_id, p_transaction_id, pay->>'method', round((pay->>'amount')::numeric,2), nullif(pay->>'reference',''));
  end loop;

  for item in select value from jsonb_array_elements(p_items) loop
    product_id := (item->>'product_id')::uuid;
    quantity := round((item->>'quantity')::numeric, 3);
    factor := round(coalesce((item->>'factor')::numeric, 1), 6);
    consumed := quantity * factor;
    update public.products
      set stock_quantity = stock_quantity - consumed, updated_at = now()
      where id = product_id and user_id = p_user_id and active = true and stock_quantity >= consumed;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Stock changed during checkout — no sale was kept'; end if;
  end loop;

  if p_customer_id is not null then
    update public.customers c set
      total_spent = coalesce(a.spent,0), total_orders = coalesce(a.orders,0),
      first_purchase_at = a.first_purchase, last_purchase_at = a.last_purchase
    from (
      select coalesce(sum(total),0) spent, count(*) orders, min(created_at) first_purchase,
             max(created_at) last_purchase
      from public.transactions where customer_id = p_customer_id and status = 'completed'
    ) a where c.id = p_customer_id and c.user_id = p_user_id;
  end if;

  insert into public.activity_logs (user_id, action_type, description, time_saved_minutes, money_saved, provider, metadata)
  values (p_user_id, 'invoice', 'Sale ' || trim(p_receipt_number) || ' — ₹' || total_calc::text,
          8, 4, 'pos', jsonb_build_object('receipt_number', trim(p_receipt_number), 'payment_method', p_payment_method));

  return jsonb_build_object('id', p_transaction_id, 'duplicate', false, 'total', total_calc);
end;
$function$;

-- ── 4. Atomic sale void / stock return ──────────────────────────
create or replace function public.void_sale(
  p_transaction_id uuid,
  p_user_id uuid,
  p_reason text,
  p_voided_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  sale_row public.transactions%rowtype;
  item jsonb;
  product_id uuid;
  consumed numeric;
  affected integer;
  existing_user uuid;
begin
  if auth.uid() is null or p_user_id is null or (select auth.uid()) <> p_user_id
     or not public.is_business_owner(p_user_id) then
    raise exception 'Only the business owner can void a sale';
  end if;
  if nullif(trim(coalesce(p_reason,'')), '') is null or length(p_reason) > 500 then
    raise exception 'A void reason is required';
  end if;
  select * into sale_row from public.transactions where id = p_transaction_id and user_id = p_user_id for update;
  if not found then raise exception 'Sale not found'; end if;
  if sale_row.status = 'void' then return jsonb_build_object('id', p_transaction_id, 'duplicate', true); end if;
  if sale_row.status <> 'completed' then raise exception 'Only a completed sale can be voided'; end if;

  for item in select value from jsonb_array_elements(sale_row.items) loop
    product_id := (item->>'product_id')::uuid;
    consumed := (item->>'quantity')::numeric * coalesce((item->>'factor')::numeric,1);
    update public.products set stock_quantity = stock_quantity + consumed, updated_at = now()
      where id = product_id and user_id = p_user_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Product no longer exists; sale was not voided'; end if;
  end loop;

  update public.transactions set status = 'void', void_reason = trim(p_reason),
    voided_at = now(), voided_by = nullif(trim(coalesce(p_voided_by,'')), '')
    where id = p_transaction_id and user_id = p_user_id;

  if sale_row.customer_id is not null then
    update public.customers c set
      total_spent = coalesce(a.spent,0), total_orders = coalesce(a.orders,0),
      first_purchase_at = a.first_purchase, last_purchase_at = a.last_purchase
    from (
      select coalesce(sum(total),0) spent, count(*) orders, min(created_at) first_purchase,
             max(created_at) last_purchase
      from public.transactions where customer_id = sale_row.customer_id and status = 'completed'
    ) a where c.id = sale_row.customer_id and c.user_id = p_user_id;
  end if;

  insert into public.activity_logs (user_id, action_type, description, time_saved_minutes, money_saved, provider, metadata)
  values (p_user_id, 'invoice', 'Voided sale ' || sale_row.receipt_number || ' — ' || trim(p_reason),
          0, 0, 'pos', jsonb_build_object('voided_receipt', sale_row.receipt_number, 'reason', trim(p_reason)));
  return jsonb_build_object('id', p_transaction_id, 'duplicate', false);
end;
$function$;

revoke execute on function public.complete_sale(uuid,uuid,uuid,text,jsonb,numeric,numeric,numeric,numeric,text,numeric,numeric,text,jsonb,text) from public, anon;
grant execute on function public.complete_sale(uuid,uuid,uuid,text,jsonb,numeric,numeric,numeric,numeric,text,numeric,numeric,text,jsonb,text) to authenticated;
revoke execute on function public.void_sale(uuid,uuid,text,text) from public, anon;
grant execute on function public.void_sale(uuid,uuid,text,text) to authenticated;

-- ── 5. Atomic AI usage reservation ─────────────────────────────
-- Batch jobs reserve one action at a time so concurrent tabs/functions cannot
-- all pass a stale count check and overspend the owner's monthly allowance.
create or replace function public.reserve_api_usage(
  p_user_id uuid,
  p_amount integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  usage_limit integer;
  profile_row public.profiles%rowtype;
begin
  if (select auth.role()) <> 'service_role' and not public.is_team_member(p_user_id) then
    raise exception 'Not authorised to reserve usage for this business';
  end if;
  if p_user_id is null or p_amount is null or p_amount < 1 or p_amount > 1000 then
    raise exception 'Invalid usage reservation';
  end if;
  select * into profile_row from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Usage owner not found'; end if;
  usage_limit := case when profile_row.trial_ends_at > now()
    then greatest(profile_row.api_usage_limit, 500) else profile_row.api_usage_limit end;
  update public.profiles
  set api_usage_count = api_usage_count + p_amount, updated_at = now()
  where id = p_user_id and api_usage_count + p_amount <= usage_limit;
  return found;
end;
$function$;
revoke execute on function public.reserve_api_usage(uuid,integer) from public, anon, authenticated;
grant execute on function public.reserve_api_usage(uuid,integer) to service_role;

-- Release only a reservation for which the downstream provider/action was never
-- reached. The row lock keeps release and reset operations deterministic.
create or replace function public.release_api_usage(
  p_user_id uuid,
  p_amount integer default 1
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Only the usage service may release reservations';
  end if;
  if p_user_id is null or p_amount is null or p_amount < 1 or p_amount > 1000 then
    raise exception 'Invalid usage release';
  end if;
  update public.profiles
  set api_usage_count = greatest(0, api_usage_count - p_amount), updated_at = now()
  where id = p_user_id;
  return found;
end;
$function$;
revoke execute on function public.release_api_usage(uuid,integer) from public, anon, authenticated;
grant execute on function public.release_api_usage(uuid,integer) to service_role;

-- ── 6. Server-authoritative subscription entitlement ────────────
-- Stripe webhooks and the owner-only subscription edge function use this
-- single transaction. No browser role is granted execute permission.
create or replace function public.apply_subscription_entitlement(
  p_user_id uuid,
  p_plan text,
  p_status text,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null,
  p_current_period_end timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  effective_plan text := case when p_status in ('active','trialing') then p_plan else 'free' end;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Only the billing service may change entitlements';
  end if;
  if p_user_id is null or p_plan not in ('free','starter','pro','enterprise') then
    raise exception 'Invalid subscription owner or plan';
  end if;
  if p_status not in ('active','canceled','past_due','trialing') then
    raise exception 'Invalid subscription status';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Subscription owner profile not found';
  end if;

  update public.profiles
  set plan = effective_plan,
      plan_tier = case when effective_plan = 'free' then 'free' else 'paid' end,
      api_usage_limit = case effective_plan
        when 'starter' then 500 when 'pro' then 2000 when 'enterprise' then 10000 else 50 end,
      updated_at = now()
  where id = p_user_id;

  insert into public.subscriptions (
    user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end
  ) values (
    p_user_id, p_stripe_customer_id, p_stripe_subscription_id, p_plan, p_status, p_current_period_end
  )
  on conflict (user_id) do update set
    stripe_customer_id = coalesce(excluded.stripe_customer_id, public.subscriptions.stripe_customer_id),
    stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.subscriptions.stripe_subscription_id),
    plan = excluded.plan,
    status = excluded.status,
    current_period_end = excluded.current_period_end;
end;
$function$;
revoke execute on function public.apply_subscription_entitlement(uuid,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.apply_subscription_entitlement(uuid,text,text,text,text,timestamptz) to service_role;

-- ── 7. Auditable approvals: decide, do not delete ──────────────
-- A denial remains visible as a decision. Approval and the product mutation
-- happen in one transaction, so a retry cannot duplicate an add/delete/restock.
drop policy if exists "Owner manages their change requests" on public.change_requests;
drop policy if exists "Requester can create and read own" on public.change_requests;
drop policy if exists "Requester can insert" on public.change_requests;
drop policy if exists "Owner or requester can read" on public.change_requests;
drop policy if exists "Owner can decide change requests" on public.change_requests;
drop policy if exists "Owner can delete change requests" on public.change_requests;
create policy "Owner or requester can read" on public.change_requests
  for select to authenticated
  using ((select auth.uid()) = owner_user_id or (select auth.uid()) = requester_id);
create policy "Requester can insert" on public.change_requests
  for insert to authenticated
  with check ((select auth.uid()) = requester_id and public.is_team_member(owner_user_id));
create policy "Owner can decide change requests" on public.change_requests
  for update to authenticated
  using ((select auth.uid()) = owner_user_id and status = 'pending')
  with check ((select auth.uid()) = owner_user_id);

create or replace function public.approve_change_request(p_request_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare
  cr public.change_requests%rowtype;
  p jsonb;
  affected integer;
  product_name text;
  product_price numeric;
  product_cost numeric;
  product_stock numeric;
  product_threshold numeric;
  product_gst numeric;
  product_row public.products%rowtype;
begin
  if auth.uid() is null or not public.is_business_owner((select auth.uid())) then
    raise exception 'Only the business owner can approve requests';
  end if;
  select * into cr from public.change_requests
    where id = p_request_id and owner_user_id = (select auth.uid())
    for update;
  if not found then raise exception 'Approval request not found'; end if;
  if cr.status <> 'pending' then
    return jsonb_build_object('id', cr.id, 'status', cr.status, 'duplicate', true);
  end if;
  if cr.capability <> 'products:manage' or cr.action_type not in ('product.add','product.delete','product.restock') then
    raise exception 'Unsupported approval action';
  end if;
  p := cr.payload;

  if cr.action_type = 'product.add' then
    product_name := nullif(trim(p->>'name'), '');
    if product_name is null or length(product_name) > 200 then raise exception 'Product name is invalid'; end if;
    product_price := (p->>'price')::numeric;
    product_cost := (p->>'cost')::numeric;
    product_stock := (p->>'stock_quantity')::numeric;
    product_threshold := (p->>'low_stock_threshold')::numeric;
    product_gst := coalesce((p->>'gst_rate')::numeric, 0);
    if product_price < 0 or product_cost < 0 or product_stock < 0 or product_threshold < 0 or product_gst < 0 or product_gst > 100 then
      raise exception 'Product numbers are invalid';
    end if;
    insert into public.products (
      user_id, name, description, sku, category, price, cost, stock_quantity,
      low_stock_threshold, hsn_code, gst_rate, units
    ) values (
      cr.owner_user_id, product_name, nullif(left(p->>'description', 2000), ''),
      nullif(left(p->>'sku', 48), ''), coalesce(nullif(left(p->>'category', 100), ''), 'general'),
      product_price, product_cost, product_stock, product_threshold,
      nullif(left(p->>'hsn_code', 20), ''), product_gst,
      case when jsonb_typeof(p->'units') = 'array' then p->'units' else null end
    );
  elsif cr.action_type = 'product.delete' then
    delete from public.products where id = (p->>'id')::uuid and user_id = cr.owner_user_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Product not found'; end if;
  elsif cr.action_type = 'product.restock' then
    -- Approval happens after the request was created. Apply the requested
    -- quantity to the stock that exists at approval time; never overwrite it
    -- with the stale absolute total that older clients used to send.
    product_stock := (p->>'add_quantity')::numeric;
    if product_stock is null or product_stock <= 0 or product_stock > 1000000000000 then
      raise exception 'Restock quantity must be positive and reasonable';
    end if;
    select * into product_row
      from public.products
      where id = (p->>'id')::uuid and user_id = cr.owner_user_id
      for update;
    if not found then raise exception 'Product not found'; end if;
    if product_row.stock_quantity + product_stock > 1000000000000 then
      raise exception 'Resulting stock is too large';
    end if;
    if p ? 'price' then
      product_price := (p->>'price')::numeric;
      if product_price is null or product_price < 0 or product_price > 1000000000000 then
        raise exception 'Product price is invalid';
      end if;
    end if;
    if p ? 'cost' then
      product_cost := (p->>'cost')::numeric;
      if product_cost is null or product_cost < 0 or product_cost > 1000000000000 then
        raise exception 'Product cost is invalid';
      end if;
    end if;
    update public.products set
      stock_quantity = stock_quantity + product_stock,
      price = case when p ? 'price' then product_price else price end,
      cost = case when p ? 'cost' then product_cost else cost end,
      updated_at = now()
    where id = product_row.id and user_id = cr.owner_user_id;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'Product not found'; end if;
  end if;

  update public.change_requests set status = 'approved', decided_at = now()
    where id = cr.id and owner_user_id = (select auth.uid());
  return jsonb_build_object('id', cr.id, 'status', 'approved', 'duplicate', false);
end;
$function$;

create or replace function public.deny_change_request(p_request_id uuid, p_decision_note text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $function$
declare affected integer;
begin
  if auth.uid() is null or not public.is_business_owner((select auth.uid())) then
    raise exception 'Only the business owner can deny requests';
  end if;
  update public.change_requests set
    status = 'denied', decided_at = now(), decision_note = nullif(left(trim(coalesce(p_decision_note,'')), 500), '')
  where id = p_request_id and owner_user_id = (select auth.uid()) and status = 'pending';
  get diagnostics affected = row_count;
  if affected <> 1 then
    if exists (select 1 from public.change_requests where id = p_request_id and owner_user_id = (select auth.uid()))
      then return jsonb_build_object('id', p_request_id, 'status', 'denied', 'duplicate', true);
      else raise exception 'Approval request not found';
    end if;
  end if;
  return jsonb_build_object('id', p_request_id, 'status', 'denied', 'duplicate', false);
end;
$function$;
revoke execute on function public.approve_change_request(uuid) from public, anon;
revoke execute on function public.deny_change_request(uuid, text) from public, anon;
grant execute on function public.approve_change_request(uuid) to authenticated;
grant execute on function public.deny_change_request(uuid, text) to authenticated;

-- ── 8. Single-flight campaign claiming / stale-run recovery ────
-- The edge function uses the service role only for this small state transition;
-- no browser can claim a campaign. Row locking makes two launch clicks (or two
-- tabs/managers) deterministic: one receives true, the other receives false.
drop function if exists public.claim_campaign_send(uuid,uuid,integer);
create or replace function public.claim_campaign_send(
  p_campaign_id uuid,
  p_run_id uuid,
  p_stale_after_seconds integer default 900,
  p_include_generated boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  campaign_status text;
  heartbeat timestamptz;
  stale_before timestamptz;
  campaign_owner_id uuid;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Only the campaign worker can claim a send';
  end if;
  if p_campaign_id is null or p_run_id is null or p_stale_after_seconds < 60 or p_stale_after_seconds > 86400 then
    raise exception 'Invalid campaign claim';
  end if;
  stale_before := now() - make_interval(secs => p_stale_after_seconds);

  select user_id, status, send_heartbeat_at into campaign_owner_id, campaign_status, heartbeat
    from public.email_campaigns
    where id = p_campaign_id
    for update;
  if not found or not public.is_business_owner(campaign_owner_id) then return false; end if;
  if campaign_status = 'sending' and heartbeat is not null and heartbeat > stale_before then
    return false;
  end if;
  if campaign_status not in ('draft','scheduled','partial','failed','sending') then
    return false;
  end if;
  -- A dead worker may have left a recipient in processing. It is safe to make
  -- it pending again only when the campaign heartbeat itself is stale; the
  -- claimed run id still prevents a live old worker from saving over the new
  -- claim. Recover these rows before checking for retryable work: a campaign
  -- whose only remaining rows are stale processing rows must be claimable.
  update public.campaign_recipients
  set status = 'pending', processing_run_id = null, processing_at = null,
      last_error = coalesce(last_error, 'Previous campaign worker timed out')
  where campaign_id = p_campaign_id
    and user_id = campaign_owner_id
    and status = 'processing';

  -- Do not take a lock when every remaining failure has exhausted its retry
  -- budget. Generated drafts are retryable only when delivery is configured;
  -- without a mail provider they are already complete drafts.
  if not exists (
    select 1 from public.campaign_recipients r
    where r.campaign_id = p_campaign_id
      and r.user_id = campaign_owner_id
      and (
        r.status = 'pending'
        or (r.status = 'failed' and coalesce(r.attempt_count, 0) < 8)
        or (coalesce(p_include_generated, true) and r.status = 'generated')
      )
  ) then
    return false;
  end if;

  update public.email_campaigns
  set status = 'sending', send_run_id = p_run_id, send_started_at = now(),
      send_heartbeat_at = now(), last_error = null
  where id = p_campaign_id;
  return true;
end;
$function$;
revoke execute on function public.claim_campaign_send(uuid,uuid,integer,boolean) from public, anon, authenticated;
grant execute on function public.claim_campaign_send(uuid,uuid,integer,boolean) to service_role;

-- Never let a browser overwrite a live worker's lock or replace its audience.
-- The service-role worker and tracking endpoint remain able to update delivery
-- state; owner edits/deletes are allowed again once the run is finalized.
create or replace function public.guard_campaign_run()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if (select auth.role()) <> 'service_role' and old.status = 'sending' then
    if tg_op = 'DELETE' or new.status <> 'sending' or new.send_run_id is distinct from old.send_run_id then
      raise exception 'Campaign is being sent and cannot be edited';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
drop trigger if exists guard_campaign_run on public.email_campaigns;
create trigger guard_campaign_run
  before update or delete on public.email_campaigns
  for each row execute function public.guard_campaign_run();
revoke execute on function public.guard_campaign_run() from public, anon, authenticated;

-- Enforce the campaign/recipient tenant relationship even for service-role
-- workers. RLS protects browser writes, but an explicit trigger also prevents a
-- malformed worker payload or historical helper from creating a cross-business
-- relationship through the foreign key alone.
create or replace function public.guard_campaign_recipient_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op <> 'DELETE' and not exists (
    select 1
    from public.email_campaigns c
    where c.id = new.campaign_id
      and c.user_id = new.user_id
  ) then
    raise exception 'Campaign recipient must belong to the campaign business';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
drop trigger if exists guard_campaign_recipient_tenant on public.campaign_recipients;
create trigger guard_campaign_recipient_tenant
  before insert or update on public.campaign_recipients
  for each row execute function public.guard_campaign_recipient_tenant();
revoke execute on function public.guard_campaign_recipient_tenant() from public, anon, authenticated;

create or replace function public.guard_campaign_recipient_run()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  campaign_status text;
  campaign_id_value uuid;
begin
  if (select auth.role()) = 'service_role' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  campaign_id_value := case when tg_op = 'DELETE' then old.campaign_id else new.campaign_id end;
  select status into campaign_status from public.email_campaigns where id = campaign_id_value;
  if campaign_status = 'sending' then
    raise exception 'Campaign recipients cannot be changed while the campaign is sending';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
drop trigger if exists guard_campaign_recipient_run on public.campaign_recipients;
create trigger guard_campaign_recipient_run
  before insert or update or delete on public.campaign_recipients
  for each row execute function public.guard_campaign_recipient_run();
revoke execute on function public.guard_campaign_recipient_run() from public, anon, authenticated;

-- Daily report delivery is claimed independently of report generation. This
-- closes the duplicate-send race between two cron invocations processing the
-- same retry row. A stale claim is recoverable by the service worker.
create or replace function public.claim_daily_report(
  p_report_id uuid,
  p_owner_id uuid,
  p_claim_id uuid,
  p_stale_after_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  report_status text;
  claimed_at timestamptz;
  stale_before timestamptz;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Only the report worker can claim daily reports';
  end if;
  if p_report_id is null or p_owner_id is null or p_claim_id is null
     or p_stale_after_seconds < 60 or p_stale_after_seconds > 86400
     or not public.is_business_owner(p_owner_id) then
    raise exception 'Invalid daily report claim';
  end if;
  stale_before := now() - make_interval(secs => p_stale_after_seconds);
  select status, report_claimed_at into report_status, claimed_at
    from public.daily_reports
    where id = p_report_id and user_id = p_owner_id
    for update;
  if not found then return false; end if;
  if claimed_at is not null and claimed_at >= stale_before then return false; end if;
  if report_status not in ('pending','retry','failed') then return false; end if;

  update public.daily_reports
  set report_claimed_at = now(), report_claim_id = p_claim_id
  where id = p_report_id and user_id = p_owner_id;
  return found;
end;
$function$;
revoke execute on function public.claim_daily_report(uuid,uuid,uuid,integer) from public, anon, authenticated;
grant execute on function public.claim_daily_report(uuid,uuid,uuid,integer) to service_role;

-- Invoice reminders are claimed before contacting a customer. The row lock and
-- the three-day throttle make concurrent cron retries idempotent at the business
-- level even if the provider call succeeds just before a worker times out.
drop function if exists public.claim_invoice_reminder(uuid,uuid);
create or replace function public.claim_invoice_reminder(
  p_invoice_id uuid,
  p_owner_id uuid,
  p_claim_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  invoice_row public.invoices%rowtype;
  next_status text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Only the reminder worker can claim reminders';
  end if;
  if p_invoice_id is null or p_owner_id is null or p_claim_id is null
     or not public.is_business_owner(p_owner_id) then
    raise exception 'Invalid reminder owner';
  end if;

  select * into invoice_row
    from public.invoices
    where id = p_invoice_id
      and user_id = p_owner_id
      and status in ('sent','viewed','partial','overdue')
    for update;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'not_due');
  end if;
  if coalesce(invoice_row.reminder_count, 0) >= 5 then
    return jsonb_build_object('claimed', false, 'reason', 'limit');
  end if;
  if invoice_row.last_reminder_at is not null
     and invoice_row.last_reminder_at >= now() - interval '3 days' then
    return jsonb_build_object('claimed', false, 'reason', 'throttled');
  end if;
  if invoice_row.reminder_claimed_at is not null
     and invoice_row.reminder_claimed_at >= now() - interval '30 minutes' then
    return jsonb_build_object('claimed', false, 'reason', 'in_progress');
  end if;

  next_status := case
    when invoice_row.due_date is not null and invoice_row.due_date < current_date then 'overdue'
    else invoice_row.status
  end;
  -- Do not increment reminder_count or last_reminder_at until delivery has
  -- succeeded. A provider outage must remain retryable instead of suppressing
  -- all reminders for three days.
  update public.invoices
  set reminder_claimed_at = now(),
      reminder_claim_id = p_claim_id,
      status = next_status,
      updated_at = now()
  where id = invoice_row.id and user_id = p_owner_id;

  return jsonb_build_object(
    'claimed', true,
    'status', next_status,
    'reminder_count', coalesce(invoice_row.reminder_count, 0),
    'claim_id', p_claim_id
  );
end;
$function$;
revoke execute on function public.claim_invoice_reminder(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_invoice_reminder(uuid,uuid,uuid) to service_role;

-- Finalize (or release) a claimed reminder after the provider call. The claim
-- must be owned by the worker transaction; failed delivery does not consume a
-- reminder slot, while a successful/manual reminder updates the throttle.
create or replace function public.finish_invoice_reminder(
  p_invoice_id uuid,
  p_owner_id uuid,
  p_claim_id uuid,
  p_delivered boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  invoice_row public.invoices%rowtype;
  next_status text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Only the reminder worker can finalize reminders';
  end if;
  if p_invoice_id is null or p_owner_id is null or p_claim_id is null
     or not public.is_business_owner(p_owner_id) then
    raise exception 'Invalid reminder finalization';
  end if;
  select * into invoice_row
    from public.invoices
    where id = p_invoice_id and user_id = p_owner_id
    for update;
  if not found or invoice_row.reminder_claimed_at is null
     or invoice_row.reminder_claim_id is distinct from p_claim_id then return false; end if;

  if p_delivered then
    next_status := case
      when invoice_row.due_date is not null and invoice_row.due_date < current_date then 'overdue'
      else invoice_row.status
    end;
    update public.invoices
    set reminder_count = least(5, coalesce(reminder_count, 0) + 1),
        last_reminder_at = now(),
        reminder_claimed_at = null,
        reminder_claim_id = null,
        status = next_status,
        updated_at = now()
    where id = p_invoice_id and user_id = p_owner_id;
  else
    update public.invoices
    set reminder_claimed_at = null, reminder_claim_id = null, updated_at = now()
    where id = p_invoice_id and user_id = p_owner_id;
  end if;
  return true;
end;
$function$;
revoke execute on function public.finish_invoice_reminder(uuid,uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.finish_invoice_reminder(uuid,uuid,uuid,boolean) to service_role;

-- ── 9. Role-aware write boundary for sensitive tables ──────────
-- v23/v27 team policies intentionally make business reads available to active
-- members. They must not also make every financial/catalog mutation available
-- to a browser. UI approval flows are helpful, but these policies are the
-- final boundary against a modified client or direct REST request.
do $$
declare
  tbl text;
  pol record;
  owner_write text[] := array[
    'products','invoices','quotations','expenses','suppliers','reports',
    'purchase_orders','khata_entries','recurring_invoices','failed_jobs','invoice_reminders'
  ];
  read_only text[] := array['transactions','sale_payments','cash_sessions'];
begin
  foreach tbl in array (owner_write || read_only) loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = tbl loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select public.is_team_member(user_id)))',
      'Team can view ' || tbl, tbl
    );
  end loop;

  foreach tbl in array owner_write loop
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)))',
      'Owner inserts ' || tbl, tbl
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id))) with check ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)))',
      'Owner updates ' || tbl, tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)))',
      'Owner deletes ' || tbl, tbl
    );
  end loop;
end $$;

-- Foreign keys do not enforce tenant ownership. Keep relationship columns
-- inside the same business as their parent row, even when a caller supplies a
-- valid UUID from another business.
drop policy if exists "Owner inserts purchase_orders" on public.purchase_orders;
drop policy if exists "Owner updates purchase_orders" on public.purchase_orders;
create policy "Owner inserts purchase_orders" on public.purchase_orders
  for insert to authenticated
  with check (
    (select auth.uid()) = purchase_orders.user_id
    and (select public.is_business_owner(purchase_orders.user_id))
    and (purchase_orders.supplier_id is null or exists (
      select 1 from public.suppliers s
      where s.id = purchase_orders.supplier_id and s.user_id = purchase_orders.user_id
    ))
  );
create policy "Owner updates purchase_orders" on public.purchase_orders
  for update to authenticated
  using ((select auth.uid()) = purchase_orders.user_id and (select public.is_business_owner(purchase_orders.user_id)))
  with check (
    (select auth.uid()) = purchase_orders.user_id
    and (select public.is_business_owner(purchase_orders.user_id))
    and (purchase_orders.supplier_id is null or exists (
      select 1 from public.suppliers s
      where s.id = purchase_orders.supplier_id and s.user_id = purchase_orders.user_id
    ))
  );

drop policy if exists "Owner inserts quotations" on public.quotations;
drop policy if exists "Owner updates quotations" on public.quotations;
create policy "Owner inserts quotations" on public.quotations
  for insert to authenticated
  with check (
    (select auth.uid()) = quotations.user_id
    and (select public.is_business_owner(quotations.user_id))
    and (quotations.customer_id is null or exists (
      select 1 from public.customers c
      where c.id = quotations.customer_id and c.user_id = quotations.user_id
    ))
  );
create policy "Owner updates quotations" on public.quotations
  for update to authenticated
  using ((select auth.uid()) = quotations.user_id and (select public.is_business_owner(quotations.user_id)))
  with check (
    (select auth.uid()) = quotations.user_id
    and (select public.is_business_owner(quotations.user_id))
    and (quotations.customer_id is null or exists (
      select 1 from public.customers c
      where c.id = quotations.customer_id and c.user_id = quotations.user_id
    ))
  );

drop policy if exists "Owner inserts khata_entries" on public.khata_entries;
drop policy if exists "Owner updates khata_entries" on public.khata_entries;
create policy "Owner inserts khata_entries" on public.khata_entries
  for insert to authenticated
  with check (
    (select auth.uid()) = khata_entries.user_id
    and (select public.is_business_owner(khata_entries.user_id))
    and (khata_entries.customer_id is null or exists (
      select 1 from public.customers c
      where c.id = khata_entries.customer_id and c.user_id = khata_entries.user_id
    ))
  );
create policy "Owner updates khata_entries" on public.khata_entries
  for update to authenticated
  using ((select auth.uid()) = khata_entries.user_id and (select public.is_business_owner(khata_entries.user_id)))
  with check (
    (select auth.uid()) = khata_entries.user_id
    and (select public.is_business_owner(khata_entries.user_id))
    and (khata_entries.customer_id is null or exists (
      select 1 from public.customers c
      where c.id = khata_entries.customer_id and c.user_id = khata_entries.user_id
    ))
  );

-- Bank imports can mark an invoice paid, so the optional invoice link must be
-- owned by the same business as the imported transaction.
drop policy if exists "Owner can manage bank_transactions" on public.bank_transactions;
create policy "Owner can manage bank_transactions" on public.bank_transactions
  for all to authenticated
  using ((select auth.uid()) = bank_transactions.user_id and (select public.is_business_owner(bank_transactions.user_id)))
  with check (
    (select auth.uid()) = bank_transactions.user_id
    and (select public.is_business_owner(bank_transactions.user_id))
    and (bank_transactions.invoice_id is null or exists (
      select 1 from public.invoices i
      where i.id = bank_transactions.invoice_id and i.user_id = bank_transactions.user_id
    ))
  );

-- Customer creation is needed at the POS for staff, but CRM edits/deletes and
-- all campaign browser writes are limited to the roles that own those surfaces.
do $$
declare
  r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename = any(array['customers','email_campaigns','campaign_recipients','activity_logs'])
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "Team can view customers" on public.customers
  for select to authenticated
  using ((select public.is_team_member(user_id)));
create policy "Team can create customers" on public.customers
  for insert to authenticated
  with check ((select public.can_create_customer(user_id)));
create policy "Owner or manager updates customers" on public.customers
  for update to authenticated
  using ((select public.can_manage_customer(user_id)))
  with check ((select public.can_manage_customer(user_id)));
create policy "Owner or manager deletes customers" on public.customers
  for delete to authenticated
  using ((select public.can_manage_customer(user_id)));

create policy "Team can view campaigns" on public.email_campaigns
  for select to authenticated
  using ((select public.is_team_member(user_id)));
create policy "Owner or manager creates campaigns" on public.email_campaigns
  for insert to authenticated
  with check ((select public.can_direct_capability(user_id, 'campaigns:manage')));
create policy "Owner or manager updates campaigns" on public.email_campaigns
  for update to authenticated
  using ((select public.can_direct_capability(user_id, 'campaigns:manage')))
  with check ((select public.can_direct_capability(user_id, 'campaigns:manage')));
create policy "Owner or manager deletes campaigns" on public.email_campaigns
  for delete to authenticated
  using ((select public.can_direct_capability(user_id, 'campaigns:manage')));

create policy "Team can view campaign recipients" on public.campaign_recipients
  for select to authenticated
  using (
    (select public.is_team_member(campaign_recipients.user_id))
    and exists (
      select 1 from public.email_campaigns c
      where c.id = campaign_recipients.campaign_id
        and c.user_id = campaign_recipients.user_id
    )
  );
create policy "Owner or manager creates campaign recipients" on public.campaign_recipients
  for insert to authenticated
  with check (
    (select public.can_direct_capability(campaign_recipients.user_id, 'campaigns:manage'))
    and exists (
      select 1 from public.email_campaigns c
      where c.id = campaign_recipients.campaign_id
        and c.user_id = campaign_recipients.user_id
    )
  );
create policy "Owner or manager updates campaign recipients" on public.campaign_recipients
  for update to authenticated
  using (
    (select public.can_direct_capability(campaign_recipients.user_id, 'campaigns:manage'))
    and exists (
      select 1 from public.email_campaigns c
      where c.id = campaign_recipients.campaign_id
        and c.user_id = campaign_recipients.user_id
    )
  )
  with check (
    (select public.can_direct_capability(campaign_recipients.user_id, 'campaigns:manage'))
    and exists (
      select 1 from public.email_campaigns c
      where c.id = campaign_recipients.campaign_id
        and c.user_id = campaign_recipients.user_id
    )
  );
create policy "Owner or manager deletes campaign recipients" on public.campaign_recipients
  for delete to authenticated
  using (
    (select public.can_direct_capability(campaign_recipients.user_id, 'campaigns:manage'))
    and exists (
      select 1 from public.email_campaigns c
      where c.id = campaign_recipients.campaign_id
        and c.user_id = campaign_recipients.user_id
    )
  );

-- Activity logs are append-only from trusted edge functions/RPCs. A team member
-- may read their business history but cannot forge an audit entry in REST.
create policy "Team can view activity logs" on public.activity_logs
  for select to authenticated
  using ((select public.is_team_member(user_id)));

-- Cleanup for scheduled jobs / duplicate data is intentionally separate from
-- this migration. Apply it only after inspecting production rows.

-- ── 10. Final policy hardening for AI, email, audit and cash ─────
-- The broad v23 team policy is deliberately narrowed here. Reads remain
-- available to active members where the screen is shared; writes stay with the
-- owner, the approved manager capability, or trusted service-role workers.
do $$
declare
  r record;
begin
  for r in select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'emails','business_memory','ai_predictions','ai_corrections',
        'daily_reports','whatsapp_messages','cash_sessions',
        'subscriptions','integration_audit_logs','team_members'
      ])
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Email Assistant is part of campaigns:manage. This fixes the previous
-- owner-id-only policy, which let managers open the screen but rejected their
-- legitimate generated-email save/delete operations.
create policy "Team can view emails" on public.emails
  for select to authenticated
  using ((select public.is_team_member(user_id)));
create policy "Campaign managers create emails" on public.emails
  for insert to authenticated
  with check ((select public.can_direct_capability(user_id, 'campaigns:manage')));
create policy "Campaign managers update emails" on public.emails
  for update to authenticated
  using ((select public.can_direct_capability(user_id, 'campaigns:manage')))
  with check ((select public.can_direct_capability(user_id, 'campaigns:manage')));
create policy "Campaign managers delete emails" on public.emails
  for delete to authenticated
  using ((select public.can_direct_capability(user_id, 'campaigns:manage')));

-- Meraj memory is shared for reading, but only the owner or a trusted service
-- role may write the durable business summary/preferences.
create policy "Team can view business memory" on public.business_memory
  for select to authenticated
  using ((select public.is_team_member(user_id)));
create policy "Owner manages business memory" on public.business_memory
  for all to authenticated
  using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)))
  with check ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)));

-- Predictions can be reviewed by a team member, but approval, dismissal and
-- deletion are owner decisions. The AI edge workers use service_role.
create policy "Team can view AI predictions" on public.ai_predictions
  for select to authenticated
  using ((select public.is_team_member(user_id)));
create policy "Owner manages AI predictions" on public.ai_predictions
  for all to authenticated
  using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)))
  with check ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)));

create policy "Team can view AI corrections" on public.ai_corrections
  for select to authenticated
  using ((select public.is_team_member(user_id)));
create policy "Owner manages AI corrections" on public.ai_corrections
  for all to authenticated
  using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)))
  with check ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)));

-- These are worker-generated ledgers. A browser may read them but cannot forge
-- delivery status, daily reports, or inbound/outbound WhatsApp history.
create policy "Team can view daily reports" on public.daily_reports
  for select to authenticated
  using ((select public.is_team_member(user_id)));
create policy "Team can view WhatsApp messages" on public.whatsapp_messages
  for select to authenticated
  using ((select public.is_team_member(user_id)));

-- EOD cash is reviewable by the team, but a counted drawer value is an
-- owner-controlled financial record. Restore the owner write parity removed by
-- the read-only financial policy pass.
create policy "Team can view cash sessions" on public.cash_sessions
  for select to authenticated
  using ((select public.is_team_member(user_id)));
create policy "Owner inserts cash sessions" on public.cash_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)));
create policy "Owner updates cash sessions" on public.cash_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)))
  with check ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)));
create policy "Owner deletes cash sessions" on public.cash_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)));

-- Billing and audit rows are not browser mutation surfaces. Their edge
-- functions use service_role and retain access despite these authenticated
-- grants being removed.
create policy "Owner can view subscriptions" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)));
revoke insert, update, delete on public.subscriptions from authenticated;

create policy "Owner can view integration audit logs" on public.integration_audit_logs
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)));
revoke insert, update, delete on public.integration_audit_logs from authenticated;

-- Team administration is performed by team-link with the service role. The
-- browser only needs the owner-side roster read.
create policy "Owner can view team" on public.team_members
  for select to authenticated
  using ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)));
revoke insert, update, delete on public.team_members from authenticated;

-- Held-cart records are shared for counter visibility, but a cashier may
-- delete only a cart they parked. The owner can manage every cart; no browser
-- client can forge a different creator because created_by is checked here.
do $$
declare
  r record;
begin
  for r in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'held_carts'
  loop
    execute format('drop policy if exists %I on public.held_carts', r.policyname);
  end loop;
end $$;
create policy "Team can view held carts" on public.held_carts
  for select to authenticated
  using ((select public.is_team_member(user_id)));
create policy "Counter can hold carts" on public.held_carts
  for insert to authenticated
  with check (
    (select public.can_direct_capability(user_id, 'sales:create'))
    and created_by = (select auth.uid())
  );
create policy "Cart creator can update held carts" on public.held_carts
  for update to authenticated
  using (
    (select public.can_direct_capability(user_id, 'sales:create'))
    and created_by = (select auth.uid())
  )
  with check (
    (select public.can_direct_capability(user_id, 'sales:create'))
    and created_by = (select auth.uid())
  );
create policy "Owner or cart creator can delete held carts" on public.held_carts
  for delete to authenticated
  using (
    ((select auth.uid()) = user_id and (select public.is_business_owner(user_id)))
    or (
      created_by = (select auth.uid())
      and (select public.can_direct_capability(user_id, 'sales:create'))
    )
  );

-- Legacy client-callable helpers are not alternate business workflows. Keep
-- only the supplier recompute used by the owner supplier screen; campaign
-- stats are worker-only and all other legacy stock/stat helpers are retired.
revoke execute on function public.grant_trial(uuid) from public, anon, authenticated;
revoke execute on function public.increment_api_usage(uuid) from public, anon, authenticated;
revoke execute on function public.decrement_stock(uuid, integer) from public, anon, authenticated;
revoke execute on function public.adjust_stock(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.recompute_customer_stats(uuid) from public, anon, authenticated;
revoke execute on function public.sync_campaign_stats(uuid) from public, anon, authenticated;
revoke execute on function public.log_integration_event(uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.recompute_supplier_outstanding(uuid) to authenticated;
grant execute on function public.sync_campaign_stats(uuid) to service_role;

-- Recompute a supplier only inside the owner's own business. The invoker
-- security mode keeps the normal supplier RLS boundary in force as well.
create or replace function public.recompute_supplier_outstanding(supplier_uuid uuid)
returns void
language sql
security invoker
set search_path = public
as $function$
  with agg as (
    select coalesce(sum(total), 0) as owed
    from public.purchase_orders
    where supplier_id = supplier_uuid
      and user_id = (select auth.uid())
      and status in ('ordered','received')
  )
  update public.suppliers s
  set outstanding = agg.owed
  from agg
  where s.id = supplier_uuid
    and s.user_id = (select auth.uid())
    and (select public.is_business_owner((select auth.uid())));
$function$;
