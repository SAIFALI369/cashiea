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
