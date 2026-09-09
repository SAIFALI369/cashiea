-- ════════════════════════════════════════════════════════════════
-- Cashiea schema v32 — The Autonomous Core (2026-09-09)
--
-- automation_events : the Command Center log — every autonomous
--                     action Cashiea takes becomes a receipt card
--                     ("Action taken by Cashiea") with Undo support.
-- automation_rules  : per-business toggles + guardrails for each
--                     autonomous feature (owner-editable).
-- cron              : automation-heartbeat every 30 min drives the
--                     automation-engine edge function.
-- ════════════════════════════════════════════════════════════════

-- ── 1. automation_events ─────────────────────────────────────────
create table if not exists automation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,               -- self_order | churn_winback | ar_escalation | cash_runway | expiry_guard
  title text not null,
  body text,
  severity text not null default 'info',   -- info | success | warning | critical
  money_impact numeric not null default 0, -- ₹ saved / ordered / at stake
  receipt jsonb not null default '{}',     -- full detail for "View Receipt"
  undo_kind text,                          -- null = not undoable | 'cancel_po'
  undo_ref uuid,                           -- purchase_orders.id when undo_kind = cancel_po
  undone boolean not null default false,
  seen boolean not null default false,     -- owner opened the card
  created_at timestamptz not null default now()
);
create index if not exists automation_events_user_created on automation_events(user_id, created_at desc);
create index if not exists automation_events_type_time on automation_events(user_id, type, created_at desc);

alter table automation_events enable row level security;
drop policy if exists "owner reads own automation events" on automation_events;
create policy "owner reads own automation events" on automation_events
  for select using (auth.uid() = user_id);
-- No client insert/update/delete policies: only the service role
-- (automation engine) writes events. Undo goes through the engine
-- endpoint, which verifies ownership before mutating.

-- Live notification cards: push new events to the owner's app instantly
do $$
begin
  alter publication supabase_realtime add table automation_events;
exception when duplicate_object then null;
end $$;

-- ── 2. automation_rules ──────────────────────────────────────────
create table if not exists automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,               -- self_order | churn_winback | ar_escalation | cash_runway | expiry_guard
  config jsonb not null default '{}',
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, type)
);
create index if not exists automation_rules_user on automation_rules(user_id);

alter table automation_rules enable row level security;
drop policy if exists "owner manages own automation rules" on automation_rules;
create policy "owner manages own automation rules" on automation_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Expiry tracking for the Expiry Guardian (perishable goods)
alter table products add column if not exists expiry_date date;

-- ── 3. heartbeat cron — every 30 minutes ─────────────────────────
select cron.schedule('automation-heartbeat', '*/30 * * * *', $$
  select net.http_post(url := 'https://prwvaetatdidsugczluv.functions.supabase.co/automation-engine?job=heartbeat',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='cron_service_role_key')),
    body := '{}'::jsonb);
$$);
