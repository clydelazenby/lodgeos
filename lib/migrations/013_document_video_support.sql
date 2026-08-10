-- ============================================================
-- 013: Video support in the document library
-- ============================================================
--
-- Lodges want to hold training material — degree instruction, ritual
-- walkthroughs, officer handover recordings — alongside by-laws and
-- minutes. The bucket accepted only PDFs, Word files and images, and
-- capped everything at 25MB, which no usable video clears.
--
-- Raises the cap to 500MB and adds the video and audio types browsers
-- can actually play back natively.
--
-- ON THE 500MB FIGURE
-- Deliberately not "unlimited". A lodge uploading a multi-gigabyte raw
-- camera file would blow through Supabase storage quota and be
-- unplayable for any brother on a phone connection. 500MB comfortably
-- holds an hour of compressed 720p, which is what a lodge actually has.
--
-- SAFE TO RE-RUN.

update storage.buckets
set
  file_size_limit = 524288000, -- 500MB
  allowed_mime_types = array[
    -- Documents (unchanged)
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp',

    -- Video. mp4/H.264 is the only format that plays everywhere without
    -- a plugin; webm and quicktime are included because they are what
    -- phones and screen recorders actually produce, and rejecting a
    -- file the officer just recorded on their phone is a bad first
    -- experience. Playback of .mov varies by browser — the UI warns
    -- about that at upload time rather than silently accepting a file
    -- half the lodge cannot watch.
    'video/mp4', 'video/webm', 'video/quicktime',

    -- Audio, for recorded lectures and minutes dictation.
    'audio/mpeg', 'audio/mp4', 'audio/wav'
  ]
where id = 'documents';

-- Duration in seconds, populated by the browser from the loaded video
-- before upload. Lets the library show "12:34" next to a training video
-- so a brother knows what he is committing to before tapping play on a
-- mobile connection.
alter table public.documents
  add column if not exists duration_seconds integer;

comment on column public.documents.duration_seconds is
  'Playback length for video/audio documents, read from the file in the browser at upload time. Null for documents that are not time-based media.';
