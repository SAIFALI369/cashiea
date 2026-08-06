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
