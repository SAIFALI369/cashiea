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
