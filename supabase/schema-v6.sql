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
