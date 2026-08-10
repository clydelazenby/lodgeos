-- ============================================================
-- 011: Record what actually happened to each communication
-- ============================================================
--
-- `communications` recorded that a notice was sent, but nothing about
-- whether it arrived. A secretary looking at the history saw a subject
-- line and a date, with no way to tell the difference between "went to
-- all 47 brothers" and "went to 12 because the rest have no email on
-- file." Delivery outcome is the part a secretary is actually
-- accountable for.
--
-- SAFE TO RE-RUN.

alter table public.communications
  add column if not exists recipient_count integer default 0;

alter table public.communications
  add column if not exists sent_count integer default 0;

alter table public.communications
  add column if not exists failed_count integer default 0;

-- Address plus reason, e.g. [{"email":"x@y.com","reason":"no email on file"}].
-- jsonb rather than text[] because the reason matters as much as the
-- address — "invalid address" and "Resend rejected the batch" call for
-- different fixes from the secretary, and a bare list of addresses
-- can't tell them apart.
alter table public.communications
  add column if not exists failed_recipients jsonb default '[]'::jsonb;

comment on column public.communications.failed_recipients is
  'Recipients not reached, with the reason for each. Written by /api/communications/send. Empty array means every intended recipient was accepted by the email provider.';

-- Drafts are listed separately from sent history and ordered by recency;
-- this makes that filter an index scan rather than a scan of every
-- notice the lodge has ever sent.
create index if not exists idx_communications_tenant_draft
  on public.communications (tenant_id, is_draft, created_at desc);

analyze public.communications;
