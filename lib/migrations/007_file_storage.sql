-- ============================================================
-- MIGRATION: file storage (avatars + documents)
-- Run against an already-provisioned database.
--
-- Two real gaps closed here:
-- 1. profiles.avatar_url already existed as a column (line 70 of
--    schema.sql) but nothing ever wrote to it or read it — no upload
--    path, no display anywhere. This migration adds the actual storage
--    bucket + policies that make that column meaningful.
-- 2. documents.file_url expected a real uploaded file, but no bucket
--    or upload path existed for it either — the record-keeping half
--    of a document library existed without the file-storage half.
--
-- Supabase Storage buckets are created via the storage.buckets table,
-- not via a CREATE TABLE — this is the standard way to provision them
-- in a migration rather than through the dashboard UI, so it's
-- reproducible across environments.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880, -- 5MB — a profile photo has no legitimate reason to be larger; public since avatars are meant to be visible in the member directory
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 26214400, -- 25MB, private — a lodge by-laws PDF or scanned charter is not meant to be publicly readable by URL guessing; access is mediated by the app's own per-document access_level, not bucket-level publicness
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

-- ── Avatar storage policies ──
-- Anyone authenticated can view avatars (bucket is public, but RLS on
-- storage.objects still gates the upload/delete actions specifically).
-- A member may only upload/replace/delete a file in their OWN folder,
-- enforced by requiring the first path segment to equal their user id
-- (e.g. avatars/{user_id}/photo.jpg) — this is the standard Supabase
-- Storage pattern for "users manage their own files" and prevents one
-- member from overwriting another's avatar by guessing a filename.
create policy "Avatar images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update their own avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Document storage policies ──
-- Private bucket. Read access is mediated through is_tenant_admin() for
-- writes, and through tenant membership for reads — mirroring the
-- access_level column already on the documents table (all/EA/FC/MM).
-- Storage-layer RLS here only proves "you belong to the tenant that
-- owns this file's folder" (documents/{tenant_id}/...); the finer
-- access_level (EA/FC/MM) check happens at the application layer when
-- listing documents, same as every other tenant-scoped read in this
-- app — storage RLS is not fine-grained enough to re-implement that
-- per-degree check itself.
create policy "Tenant members can view their tenant's documents"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1]::uuid in (select get_user_tenant_ids())
  );

create policy "Tenant admins can upload documents"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and is_tenant_admin((storage.foldername(name))[1]::uuid)
  );

create policy "Tenant admins can delete documents"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and is_tenant_admin((storage.foldername(name))[1]::uuid)
  );

-- ── documents table: the metadata fields the original table lacked ──
-- file_url already existed but nothing populated it in a structured
-- way; storage_path is added so the app can construct a signed URL
-- from the private bucket (a bare public file_url doesn't work for a
-- private bucket the way it did conceptually for the old empty
-- placeholder), and mime_type helps the UI pick a preview icon without
-- guessing from the filename.
alter table public.documents
  add column if not exists storage_path text,
  add column if not exists mime_type text;

comment on column public.documents.storage_path is
  'Path within the private "documents" storage bucket, e.g. {tenant_id}/{uuid}-{filename}. Used to generate signed URLs for download, since the bucket is not public.';
