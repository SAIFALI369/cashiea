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
