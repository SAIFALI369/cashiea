-- ════════════════════════════════════════════════════════════════
-- fix-avatars-bucket.sql — profile photo upload (RLS) fix. IDEMPOTENT.
--
-- Symptom: uploading a profile photo fails with
--   "new row violates row-level security policy" on storage.objects.
-- Cause:   the 'avatars' bucket + owner-scoped policies were never applied
--          to the live project. This re-creates them safely.
--
-- Each user writes ONLY to their own folder: avatars/<user_id>/avatar.jpg
-- Run in: Supabase Dashboard → SQL Editor → New query → Run.
-- ════════════════════════════════════════════════════════════════

-- 1. Public bucket (objects served via getPublicUrl without auth).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 3145728,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Owner-scoped write policies (first path segment = the user's id).
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

-- NOTE: no SELECT policy needed — public buckets serve object URLs directly.
