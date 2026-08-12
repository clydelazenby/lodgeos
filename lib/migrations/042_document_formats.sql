-- 042 · What the documents bucket will accept
--
-- THE BUCKET IS THE GATE THAT FIRES FIRST. Since the upload was moved
-- out of a serverless function (see 013 and the comment at the top of
-- components/lodge/DocumentUpload.tsx), the browser writes STRAIGHT to
-- Supabase Storage. Storage checks this column before any code of ours
-- runs, so a PowerPoint was refused here — with a storage error that
-- said nothing about which formats a lodge may use — no matter what
-- the API route or the file picker allowed.
--
-- The list mirrors lib/uploads.ts exactly. If the two drift, the file
-- picker offers something the bucket then refuses, which is the worst
-- of the three failure modes because it looks like the app is broken
-- rather than like the file is wrong.
--
-- Alternate spellings are included deliberately: Windows reports a zip
-- as application/x-zip-compressed, Safari reports .m4a as audio/x-m4a,
-- and a .wav as audio/x-wav or audio/wave depending on the machine.
-- The uploader now sets the content type from the file's EXTENSION for
-- exactly this reason, but the older spellings stay accepted so
-- documents uploaded before this migration keep working.
--
-- Re-runnable: an UPDATE, not a CREATE.

update storage.buckets
set allowed_mime_types = array[
    'application/csv',
    'application/msword',
    'application/pdf',
    'application/rtf',
    'application/vnd.apple.keynote',
    'application/vnd.apple.numbers',
    'application/vnd.apple.pages',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-powerpoint',
    'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
    'application/vnd.ms-word.document.macroEnabled.12',
    'application/vnd.oasis.opendocument.presentation',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-zip-compressed',
    'application/zip',
    'audio/aac',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/wave',
    'audio/x-m4a',
    'audio/x-wav',
    'image/bmp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/webp',
    'multipart/x-zip',
    'text/csv',
    'text/markdown',
    'text/plain',
    'text/rtf',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/webm',
    'video/x-m4v',
    'video/x-msvideo'
  ]
where id = 'documents';

-- Not here, and each omission is a decision rather than an oversight:
--
--   image/svg+xml, text/html  — scriptable documents. Everything on
--                               the list above is inert when opened.
--   executables and installers — a lodge library is not a software
--                               distribution channel, and a brother
--                               trusts what he downloads from it.
--
-- No comment on storage.buckets: that table belongs to
-- supabase_storage_admin, and commenting on it fails for us. The note
-- that matters lives at the top of lib/uploads.ts, where anyone
-- changing the list will actually be reading.
