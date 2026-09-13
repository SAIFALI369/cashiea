create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  request_id text,
  user_id uuid,
  page_path text,
  error_type text,
  message text not null,
  stack text,
  meta jsonb default '{}',
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_created on public.client_errors(created_at desc);
create index if not exists client_errors_user on public.client_errors(user_id, created_at desc);
alter table public.client_errors enable row level security;
drop policy if exists "anyone can report client errors" on public.client_errors;
create policy "anyone can report client errors" on public.client_errors
  for insert to anon, authenticated with check (true);
-- reads: service role only (owner privacy — stacks can contain business context)
revoke all on public.client_errors from anon, authenticated;
grant insert on public.client_errors to anon, authenticated;
grant select on public.client_errors to service_role;
