-- ════════════════════════════════════════════════════════════════
-- schema-v15 — Profile avatars storage bucket + policies
-- (profiles.avatar_url and profiles.role already exist from earlier migrations)
-- Run once. Safe to re-run (idempotent where possible).
-- ════════════════════════════════════════════════════════════════

-- Public-read bucket so avatar images render in the app; 3 MB cap; images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Anyone (including signed-out landing pages if ever needed) can read avatars.
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- An authenticated owner can manage only objects inside their own folder
-- (avatars/<user_id>/...). (storage.foldername(name))[1] is the top path segment.
create policy "avatars owner insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars owner delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
