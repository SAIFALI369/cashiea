-- ════════════════════════════════════════════════════════════════
-- fix-avatars-bucket.sql — profile photo upload (RLS) fix. IDEMPOTENT.
--
-- Symptom: uploading a profile photo fails with
--   "new row violates row-level security policy" / "Access denied".
-- Root cause: the owner-scoped SELECT policy was missing. Public buckets
--   serve object URLs without a SELECT policy, BUT the Storage API's own
--   upsert/delete/update operations internally SELECT the row first —
--   an invisible row = 403. So the owner MUST be able to read their row.
-- ════════════════════════════════════════════════════════════════
-- VERIFIED LIVE (real user JWT): plain insert ✅, upsert fresh ✅,
-- upsert overwrite ✅, delete ✅ after applying all four policies below.
-- Run in: Supabase Dashboard → SQL Editor (or any admin connection).
-- ════════════════════════════════════════════════════════════════

-- 1. Public bucket (objects served via getPublicUrl without auth).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 3145728,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Owner-scoped policies (first path segment = the user's id).
--    NOTE the SELECT policy — required for the Storage API's upsert/delete
--    operations to find the owner's row (see root cause above).
drop policy if exists "avatars owner read" on storage.objects;
create policy "avatars owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
