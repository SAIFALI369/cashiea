-- ════════════════════════════════════════════════════════════════
-- Cashiea schema v42 — Staff workforce: shifts + commission rules.
--
-- Closes the "Square Workforce / Clover shift management / Lightspeed
-- staff commissions" gap for a small Indian shop:
--   * staff_shifts  — clock in / clock out with break minutes
--                     (staff can clock themselves; the owner sees all)
--   * commission_rules — a commission % per staff NAME, because POS
--                     sales record `served_by` as the display name.
--
-- Deliberately NOT payroll: no salary, no statutory (PF/ESI/PT)
-- computation — that is a CA's job. This tracks time and estimates
-- commission from real sales, with the same honesty rule as always.
--
-- Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Shifts ────────────────────────────────────────────────────
create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  /** The business (owner) this shift belongs to. */
  user_id uuid not null references auth.users(id) on delete cascade,
  /** The staff member's own account when they clocked from the app. */
  staff_user_id uuid references auth.users(id) on delete set null,
  /** Display name — matches transactions.served_by for reporting. */
  staff_name text not null,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  break_minutes integer not null default 0
    check (break_minutes >= 0 and break_minutes <= 600),
  note text,
  created_at timestamptz not null default now(),
  constraint staff_shifts_sane_span check (clock_out is null or clock_out >= clock_in)
);

alter table public.staff_shifts enable row level security;
drop policy if exists "owner manages staff shifts" on public.staff_shifts;
create policy "owner manages staff shifts" on public.staff_shifts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Staff can start their own shift and close only their own open one.
drop policy if exists "staff clocks own shift in" on public.staff_shifts;
create policy "staff clocks own shift in" on public.staff_shifts
  for insert with check (
    auth.uid() = staff_user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.business_owner_id = user_id
    )
  );

drop policy if exists "staff clocks own shift out" on public.staff_shifts;
create policy "staff clocks own shift out" on public.staff_shifts
  for update using (
    auth.uid() = staff_user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.business_owner_id = user_id
    )
  );

create index if not exists idx_staff_shifts_user_day
  on public.staff_shifts (user_id, clock_in desc);

-- ── 2. Commission rules ──────────────────────────────────────────
create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  staff_name text not null,
  /** % of the sale value credited to this staff member. */
  percent numeric(5,2) not null default 0
    check (percent >= 0 and percent <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, staff_name)
);

alter table public.commission_rules enable row level security;
drop policy if exists "owner manages commission rules" on public.commission_rules;
create policy "owner manages commission rules" on public.commission_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
