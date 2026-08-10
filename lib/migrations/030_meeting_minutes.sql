-- ============================================================
-- 030: Minutes
-- ============================================================
--
-- The most important record a lodge keeps, and the app had nowhere to
-- put it. The AI Secretary would draft a set of minutes from rough
-- notes, the Secretary copied them, and they ended up in a word
-- processor file on his laptop — which is to say the lodge's principal
-- record lived on one man's computer, in a format nobody else could
-- search, and left the lodge when he did.
--
-- LIFECYCLE, WHICH IS THE POINT. Minutes are not a document that simply
-- exists; they are read at the NEXT stated communication and approved,
-- or approved as corrected. Until then they are a draft with no
-- authority. Recording that distinction is most of the value here:
--
--   draft     — being written, visible to officers only
--   submitted — finished, to be read at the next meeting
--   approved  — read and approved by the lodge, with the date and the
--               meeting at which that happened
--
-- approved_at_event_id is the meeting that APPROVED them, which is a
-- different meeting from the one they are the minutes OF. That pair is
-- the whole chain of custody a Grand Lodge inspection asks about, and
-- storing only a boolean would lose it.
--
-- ONE SET PER MEETING, enforced by a unique constraint rather than by
-- application care. Two sets of minutes for one stated communication is
-- not a state a lodge can be in.
--
-- SAFE TO RE-RUN.

create table if not exists public.meeting_minutes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,

  -- The meeting these are the minutes OF.
  event_id uuid references public.lodge_events(id) on delete cascade not null,

  body text not null default '',

  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved')),

  -- Deliberately not foreign keys with cascade: the minute book must
  -- outlive the officers named in it, and lodges change officers every
  -- year. Same reasoning as audit_log.actor_id.
  drafted_by uuid,
  drafted_by_name text,
  approved_by uuid,
  approved_by_name text,

  approved_on date,
  -- The meeting AT WHICH they were approved — not the meeting they
  -- record. Null until approved.
  approved_at_event_id uuid references public.lodge_events(id) on delete set null,

  -- "Approved as corrected" is a real and common outcome, and the
  -- correction itself is part of the record.
  correction_note text,

  unique (event_id)
);

comment on table public.meeting_minutes is
  'One set of minutes per meeting. Moves draft -> submitted -> approved; approval is an act of the lodge at a LATER meeting, recorded with its date and that meeting''s id. Officer-drafted, and readable by every brother once approved.';

comment on column public.meeting_minutes.approved_at_event_id is
  'The meeting at which these minutes were read and approved — a different meeting from event_id, which is the one they record. The pair is the chain of custody a Grand Lodge inspection asks about; a boolean would lose it.';

comment on column public.meeting_minutes.correction_note is
  'Set when the lodge approves the minutes AS CORRECTED. The correction is itself part of the record and belongs beside the text rather than silently edited into it.';

alter table public.meeting_minutes enable row level security;

-- APPROVED MINUTES ARE FOR THE BRETHREN. They are read aloud in open
-- lodge; a brother who was absent has every right to read what was
-- done. Drafts are not — an unapproved draft is one officer's account
-- of a meeting and carries no authority yet.
drop policy if exists "Approved minutes visible to lodge members" on public.meeting_minutes;
create policy "Approved minutes visible to lodge members" on public.meeting_minutes for select
  using (
    status = 'approved'
    and tenant_id in (select public.get_user_tenant_ids())
  );

drop policy if exists "All minutes visible to officers" on public.meeting_minutes;
create policy "All minutes visible to officers" on public.meeting_minutes for select
  using (public.is_tenant_admin(tenant_id));

drop policy if exists "Minutes managed by officers" on public.meeting_minutes;
create policy "Minutes managed by officers" on public.meeting_minutes for all
  using (public.is_tenant_admin(tenant_id));

-- The minute book is read newest-first, and looked up by meeting.
create index if not exists idx_meeting_minutes_tenant
  on public.meeting_minutes (tenant_id, created_at desc);

-- Full-text search over the body. "When did we vote on the roof?" is
-- the question a minute book exists to answer, and it is unanswerable
-- by scrolling. english is the right configuration here even for the
-- archaic register these are written in — it stems and drops stop
-- words, which is what makes a two-word search work.
create index if not exists idx_meeting_minutes_search
  on public.meeting_minutes using gin (to_tsvector('english', body));
