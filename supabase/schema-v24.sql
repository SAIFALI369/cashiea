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
