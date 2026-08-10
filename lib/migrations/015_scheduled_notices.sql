-- ============================================================
-- 015: Scheduled notices
-- ============================================================
--
-- Resend can hold a message and release it at a given instant, so
-- scheduling needs no scheduler of our own — no cron job, no polling a
-- queue, no worker. The notice is handed to Resend immediately and it
-- decides when to deliver.
--
-- That means `sent_at` alone becomes ambiguous: for a scheduled notice
-- it records when the notice was QUEUED, which is not when the brethren
-- receive it. scheduled_for carries the actual send time so the history
-- can distinguish "sent an hour ago" from "goes out Tuesday at 7pm".
--
-- Null means it went immediately, which is the overwhelming majority.
--
-- SAFE TO RE-RUN.

alter table public.communications
  add column if not exists scheduled_for timestamptz;

comment on column public.communications.scheduled_for is
  'When a scheduled notice is due to go out, as handed to Resend. Null for notices sent immediately. sent_at is when the notice was queued, which for a scheduled notice is earlier.';

-- Finds notices that are queued but not yet released, for the "Scheduled"
-- section of the Communications page. Partial so it stays tiny — this is
-- a handful of rows at any moment, against a table that grows forever.
create index if not exists idx_communications_scheduled
  on public.communications (tenant_id, scheduled_for)
  where scheduled_for is not null;
