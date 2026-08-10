-- ============================================================
-- 012: Per-recipient email delivery tracking
-- ============================================================
--
-- Migration 011 recorded how many messages Resend ACCEPTED. That is not
-- the same as how many arrived. An address can be accepted and then hard
-- bounce ten seconds later; a brother can mark the notice as spam a day
-- after that. Neither shows up in an accept count, and both are things a
-- secretary needs to know — a hard-bouncing address means a brother has
-- silently stopped receiving every notice the lodge sends.
--
-- This adds the row-per-recipient table that Resend's webhooks update,
-- keyed by the message id Resend returns at send time.
--
-- SAFE TO RE-RUN.

create table if not exists public.communication_recipients (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),

  communication_id uuid references public.communications(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,

  -- Nullable on purpose: a brother removed from the roster later
  -- shouldn't erase the delivery record of a notice already sent. The
  -- email column below is the durable identifier here.
  member_id uuid references public.profiles(id) on delete set null,
  email text not null,

  -- Resend's id for this specific message. The join key for every
  -- webhook that arrives afterwards. Null when the send failed before
  -- Resend ever accepted it (bad address, rejected batch).
  resend_email_id text,

  -- Lifecycle, roughly in order:
  --   sent       — Resend accepted it; nothing further heard yet
  --   delivered  — accepted by the receiving mail server
  --   opened     — recipient opened it (requires open tracking enabled)
  --   clicked    — recipient followed a link (requires click tracking)
  --   delayed    — temporary failure, Resend is still retrying
  --   bounced    — permanently undeliverable
  --   complained — recipient marked it as spam
  --   failed     — never accepted by Resend in the first place
  --
  -- NOT a strict state machine. 'opened' can arrive before 'delivered',
  -- and a message can be opened many times. The webhook only advances
  -- status when the new event outranks the current one (see
  -- STATUS_RANK in app/api/webhooks/resend/route.ts), so a later 'opened'
  -- can never overwrite a 'bounced'.
  status text not null default 'sent'
    check (status in ('sent','delivered','opened','clicked','delayed','bounced','complained','failed')),

  -- Provider's explanation when things went wrong. Worth keeping
  -- verbatim: "mailbox full" and "user unknown" call for different
  -- responses from the secretary.
  detail text,

  last_event_at timestamptz,

  -- One row per recipient per communication. Makes the send-time insert
  -- idempotent if a request is ever retried.
  unique (communication_id, email)
);

comment on table public.communication_recipients is
  'One row per brother per notice, tracking what actually happened to that message. Written at send time by /api/communications/send and updated by Resend webhooks at /api/webhooks/resend.';

-- The webhook looks rows up by Resend id on every event, and that is the
-- hottest query in this table by a wide margin.
create unique index if not exists idx_comm_recipients_resend_id
  on public.communication_recipients (resend_email_id)
  where resend_email_id is not null;

create index if not exists idx_comm_recipients_communication
  on public.communication_recipients (communication_id);

-- Powers the "which brothers are we failing to reach" view, which scans
-- a tenant for the two statuses that mean a real delivery problem.
create index if not exists idx_comm_recipients_tenant_status
  on public.communication_recipients (tenant_id, status)
  where status in ('bounced', 'complained');

-- ── Rolled-up counts on the parent notice ──
-- Denormalized so the history table can render without a per-row
-- subquery. Kept current by the trigger below rather than by
-- application code, so they cannot drift if a webhook is processed by
-- some other path later.
alter table public.communications
  add column if not exists delivered_count integer default 0;

alter table public.communications
  add column if not exists bounced_count integer default 0;

alter table public.communications
  add column if not exists opened_count integer default 0;

alter table public.communications
  add column if not exists complained_count integer default 0;

create or replace function public.refresh_communication_counts()
returns trigger language plpgsql security definer as $$
declare
  target_id uuid := coalesce(new.communication_id, old.communication_id);
begin
  update public.communications c
  set
    -- 'opened' and 'clicked' both imply delivery, and a bounce after an
    -- open is not a delivery. Counting by set membership rather than by
    -- "current status equals delivered" avoids undercounting every
    -- message that has since moved on to a later state.
    delivered_count = (
      select count(*) from public.communication_recipients r
      where r.communication_id = target_id
        and r.status in ('delivered','opened','clicked')
    ),
    opened_count = (
      select count(*) from public.communication_recipients r
      where r.communication_id = target_id and r.status in ('opened','clicked')
    ),
    bounced_count = (
      select count(*) from public.communication_recipients r
      where r.communication_id = target_id and r.status = 'bounced'
    ),
    complained_count = (
      select count(*) from public.communication_recipients r
      where r.communication_id = target_id and r.status = 'complained'
    )
  where c.id = target_id;

  return null;
end;
$$;

drop trigger if exists trg_refresh_communication_counts on public.communication_recipients;
create trigger trg_refresh_communication_counts
  after insert or update or delete on public.communication_recipients
  for each row execute function public.refresh_communication_counts();

-- ── RLS ──
alter table public.communication_recipients enable row level security;

-- Read-only to lodge officers. Nothing writes through RLS: the send
-- route and the webhook both use the service client, and the webhook in
-- particular has no user session at all — it is authenticated by Svix
-- signature, not by a cookie.
drop policy if exists "Delivery records visible to lodge admins" on public.communication_recipients;
create policy "Delivery records visible to lodge admins" on public.communication_recipients for select
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

analyze public.communications;
