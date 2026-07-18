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
