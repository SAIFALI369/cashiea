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
