-- ============================================================
-- LodgeOS — migrations 025 to 030, in one transaction
-- ============================================================
--
-- Paste the whole of this file into the Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query) and press Run.
--
-- WHY IT IS WRAPPED IN A TRANSACTION. These six are ordered and
-- related, and the app expects either all of them or none. If any
-- statement fails the whole thing rolls back and the database is
-- exactly as it was — rather than leaving three of six applied, which
-- is the state that is genuinely painful to reason about afterwards.
--
-- SAFE TO RE-RUN, and this is checked rather than asserted: every
-- create uses `if not exists`, every constraint is dropped before it is
-- added, every policy is dropped before it is created (Postgres has no
-- `create policy if not exists`, so without that a second run would
-- fail on the first policy it met), and the one data backfill is
-- conditional on the column still being null.
--
-- Generated from the individual files in lib/migrations/, which remain
-- the source of truth and carry the full reasoning for each change.
-- ============================================================

begin;


-- ============================================================
-- >>> 025_membership_status.sql
-- ============================================================

-- ============================================================
-- 025: Why a brother left the rolls
-- ============================================================
--
-- tenant_members recorded membership as a single boolean, is_active.
-- A brother was on the roster or he was not, and the reason he stopped
-- being on it was recorded nowhere at all.
--
-- That is not an abstract tidiness problem. Every Grand Lodge annual
-- return asks for the breakdown — demitted, suspended, expelled, died —
-- and lib/reports/AnnualReturnDocument.tsx has been carrying a printed
-- apology to that effect: "this system currently records only whether a
-- member is active or inactive... it must currently be determined
-- manually by cross-referencing lodge records." Once a year somebody
-- reconstructs from memory what the database watched happen.
--
-- The four statuses are not interchangeable, either. A demit is a
-- brother in good standing leaving of his own accord and he may be
-- received back tomorrow. A suspension for non-payment is reversible on
-- payment. An expulsion is a Grand Lodge matter. A death is permanent,
-- and it changes who the lodge writes to — his widow, not him.
--
-- WHY REMOVAL BECOMES A STATUS CHANGE. /api/members/remove deleted the
-- tenant_members row outright. The comment above it argued, correctly,
-- that attendance and payments must survive removal — and they did,
-- because they key off profiles.id. But the membership itself did not,
-- so the lodge lost the one fact the annual return actually asks for:
-- that this man was a member, and on this date he ceased to be, for
-- this reason. The row now stays and its status changes.
--
-- 'removed' exists for the case with no Masonic meaning at all: a
-- duplicate row, a typo, a test entry. It is deliberately not a
-- synonym for any of the others, so it can be excluded from a return.
--
-- BACKFILL. Everything currently active becomes 'active'. Anything
-- already inactive becomes 'inactive_unspecified' rather than a guess —
-- the reason genuinely is not in the database, and inventing one would
-- put a fabricated number on a Grand Lodge return, which is the exact
-- failure this migration exists to prevent.
--
-- SAFE TO RE-RUN.

alter table public.tenant_members
  add column if not exists membership_status text,
  add column if not exists status_date date,
  add column if not exists status_note text;

-- Backfill before the constraint, or the constraint rejects the nulls.
update public.tenant_members
  set membership_status = case when is_active then 'active' else 'inactive_unspecified' end
  where membership_status is null;

alter table public.tenant_members
  alter column membership_status set default 'active';

alter table public.tenant_members
  alter column membership_status set not null;

alter table public.tenant_members
  drop constraint if exists tenant_members_membership_status_check;

alter table public.tenant_members
  add constraint tenant_members_membership_status_check
  check (membership_status in (
    'active',
    'demitted',
    'suspended',
    'expelled',
    'deceased',
    'removed',
    'inactive_unspecified'
  ));

comment on column public.tenant_members.membership_status is
  'Why this brother is or is not on the rolls. Values and labels live in lib/membership.ts. ''active'' is the only status that keeps him on the roster; is_active is kept in step with it by the app (see /api/members/remove) and remains what RLS and every existing query key off, so this column adds a reason without changing any access rule. ''inactive_unspecified'' is the honest backfill for rows that went inactive before this column existed — it means the reason is not known, not that there was none.';

comment on column public.tenant_members.status_date is
  'The date the current status took effect — the date of the demit, the suspension, the death. Not created_at and not now(): a Secretary recording a death three weeks later needs the date it happened, because that is the date the annual return asks for.';

comment on column public.tenant_members.status_note is
  'Free text the Secretary may add, e.g. "Demitted to Corinthian #45" or "Suspended NPD, 2026 dues". Never sent to the brother; the removal email carries its own separately-entered note.';

-- The roster query filters on is_active and the annual return groups by
-- status within a date window. Both are covered here.
create index if not exists idx_tenant_members_status
  on public.tenant_members (tenant_id, membership_status, status_date);

-- ============================================================
-- >>> 026_audit_log.sql
-- ============================================================

-- ============================================================
-- 026: Who did that, and when
-- ============================================================
--
-- Nothing in this app recorded who changed anything. A dues status
-- flipped from due to paid, a brother came off the roster, a degree was
-- marked conferred, a charge appeared on an account — and afterwards
-- there was no way to answer the only question anyone ever asks about
-- those events, which is who did it.
--
-- Lodges hand over every office annually. The Secretary who made an
-- entry in March is frequently not the Secretary being asked about it
-- in November, and "the system says he's paid" is not an answer when a
-- brother is standing there with a receipt. This is unglamorous and it
-- is the first thing wanted the day there is a disagreement about money.
--
-- WHAT IS NOT HERE, DELIBERATELY:
--
-- No before/after column diffing. A generic trigger-based audit of every
-- table would capture far more than anyone reads and would quietly
-- record personal data in a second place, which is a liability rather
-- than a feature. Entries are written explicitly by the routes that
-- make meaningful changes, and each says in one line what happened.
--
-- No deletes and no updates. An audit trail that can be edited is not
-- one. RLS below grants select and insert only — there is no policy
-- permitting update or delete, so with RLS on, no client can alter a
-- row through the API at any tier. The service role bypasses RLS by
-- design, which is why entries are written with it and never rewritten.
--
-- Not a security log. It records lodge business, not sessions and IP
-- addresses.
--
-- SAFE TO RE-RUN.

create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,

  -- Nullable on purpose: a cron job sending dues reminders is a real
  -- actor with no person behind it, and recording a fake user id for it
  -- would be worse than recording none. Deliberately NOT a foreign key
  -- with on delete cascade — an entry must survive the departure of the
  -- officer who made it, which is precisely when it matters most.
  actor_id uuid,
  actor_name text,

  action text not null,
  entity_type text,
  entity_id uuid,

  -- One human sentence, written at the call site: "Marked Bro. Smith's
  -- dues paid", "Took Bro. Jones off the roster as demitted". The page
  -- reads these; it does not reconstruct prose from columns.
  summary text not null,

  -- Structured spillover for the rare case someone needs the specifics
  -- (the amount, the old value). Never rendered as the primary account
  -- of what happened.
  detail jsonb
);

comment on table public.audit_log is
  'Append-only record of meaningful lodge changes: money, roster, degrees, records. Written explicitly by API routes via lib/audit.ts, never by triggers. No update or delete policy exists, so it cannot be rewritten through the API. Not a security or access log.';

comment on column public.audit_log.actor_id is
  'The profile that acted, or null for a system actor such as the dues-reminder cron. Intentionally not a foreign key: the entry must outlive the officer, and lodges change officers every year.';

alter table public.audit_log enable row level security;

-- Readable by the lodge's administrative office only. This is the one
-- table in the app where a Deacon seeing everything the Treasurer did
-- would be a change in the lodge's own delegation of authority, so it
-- is deliberately narrower than is_tenant_admin() — which since
-- migration 022 means "holds administrative access of some kind" and
-- includes wardens and deacons.
drop policy if exists "Audit visible to the secretary's office" on public.audit_log;
create policy "Audit visible to the secretary's office" on public.audit_log for select
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_id = audit_log.tenant_id
        and user_id = auth.uid()
        and tenant_role in ('admin', 'secretary', 'grand_master', 'worshipful_master', 'treasurer')
        and is_active = true
    )
    or public.is_super_admin()
  );

-- Entries are written server-side with the service role, which bypasses
-- RLS. This policy exists so that a future in-app writer running as the
-- officer still works, and so the absence of update/delete policies is
-- an explicit statement rather than an oversight.
drop policy if exists "Audit entries insertable by the lodge" on public.audit_log;
create policy "Audit entries insertable by the lodge" on public.audit_log for insert
  with check (public.is_tenant_admin(tenant_id));

-- The page reads the newest entries for one lodge, optionally filtered
-- by action. Both are covered.
create index if not exists idx_audit_log_tenant_time
  on public.audit_log (tenant_id, created_at desc);

create index if not exists idx_audit_log_entity
  on public.audit_log (tenant_id, entity_type, entity_id);

-- ============================================================
-- >>> 027_calendar_feed.sql
-- ============================================================

-- ============================================================
-- 027: A calendar a brother subscribes to once
-- ============================================================
--
-- The app already produced a per-event .ics file, which solves the
-- wrong half of the problem: a brother adds one meeting to his phone,
-- and next month he has to be sent another link and remember to tap it.
-- Every stated communication, degree night and festive board is a fresh
-- act of clerical work performed by fifty people independently.
--
-- A subscription feed is added once and then never thought about again.
-- The calendar app re-fetches it, so a meeting moved on Tuesday moves in
-- fifty pockets on Tuesday.
--
-- WHY A TOKEN AND NOT THE SLUG. Calendar clients send no cookies and
-- offer no way to authenticate — a subscription URL is opened by iOS,
-- Google Calendar or Outlook with nothing but the URL itself. So the URL
-- has to be the credential. /psalms-of-job-1827/calendar.ics would be
-- guessable by anyone who has seen the lodge's public page, and the feed
-- carries the whole year's schedule including events not marked public.
--
-- A random uuid is 122 bits of entropy, which is not guessable, and it
-- is per-lodge rather than per-brother. That is a deliberate trade: a
-- per-brother token would let a lodge revoke one man's access, but it
-- would also mean a feed URL that identifies him, in a file his phone
-- fetches over the network several times a day. The lodge calendar is
-- not a secret from the brethren; it is merely not for the open web.
--
-- Rotatable: changing the token invalidates every existing subscription
-- at once, which is the correct blunt instrument if a URL ever leaks.
--
-- SAFE TO RE-RUN.

alter table public.tenants
  add column if not exists calendar_token uuid default gen_random_uuid();

-- Existing lodges predate the default and would otherwise hold null.
update public.tenants
  set calendar_token = gen_random_uuid()
  where calendar_token is null;

alter table public.tenants
  alter column calendar_token set not null;

comment on column public.tenants.calendar_token is
  'Unguessable key in the calendar subscription URL (/api/calendar/[token]/lodge.ics). Calendar clients cannot authenticate, so the URL is the credential. Per-lodge rather than per-brother: a per-brother token would identify the reader in a file his phone fetches all day. Rotating it revokes every existing subscription at once.';

-- The feed route looks a lodge up BY this token and by nothing else, so
-- it wants its own unique index rather than relying on the primary key.
create unique index if not exists idx_tenants_calendar_token
  on public.tenants (calendar_token);

-- ============================================================
-- >>> 028_masonic_dates.sql
-- ============================================================

-- ============================================================
-- 028: The three dates a Mason actually remembers
-- ============================================================
--
-- tenant_members had joined_date — the date a row appeared on this
-- lodge's roster — and nothing else. That is an administrative fact and
-- it is not the date any brother in the lodge would name if asked when
-- he became a Mason.
--
-- Initiated, passed and raised are the three. Raised is the one that
-- matters most: it is the anniversary a man counts from, it is what a
-- 25- or 50-year jewel is measured against, and it is what a Grand
-- Lodge means by "years of service".
--
-- Without it, recognising a brother's fiftieth year depends entirely on
-- somebody remembering — which is to say it depends on the one man who
-- has been there long enough to remember also being at that meeting.
-- Lodges lose these constantly and it is the sort of loss that is only
-- noticed afterwards.
--
-- WHY ON tenant_members AND NOT profiles. A man may be raised in one
-- lodge and affiliate with another; the raising belongs to the man, not
-- to the lodge he currently sits in. But profiles is GLOBAL in this
-- schema — one row per person shared by every lodge — and a lodge
-- Secretary should not be able to edit a date another lodge relies on.
-- Held per-membership, so an affiliating brother's raising date is
-- entered by the lodge that received him, which is also the lodge that
-- will strike his jewel.
--
-- NOT a duplicate of degree_progress.conferred_date. That table tracks
-- candidates progressing through THIS lodge's degrees, and it is empty
-- for every brother raised before the lodge started using this app —
-- which is nearly all of them, and precisely the men whose fiftieth
-- year is approaching. These three columns are what the Secretary
-- copies off the old register.
--
-- SAFE TO RE-RUN.

alter table public.tenant_members
  add column if not exists initiated_date date,
  add column if not exists passed_date date,
  add column if not exists raised_date date;

comment on column public.tenant_members.initiated_date is
  'Date he was initiated an Entered Apprentice. Historical record, typically copied from the lodge register; distinct from degree_progress, which tracks candidates currently progressing through this lodge''s degrees and is empty for anyone raised before the lodge began using LodgeOS.';

comment on column public.tenant_members.passed_date is
  'Date he was passed to the degree of Fellowcraft.';

comment on column public.tenant_members.raised_date is
  'Date he was raised a Master Mason. THE anniversary — what a brother counts from, what 25- and 50-year service awards are measured against, and what a Grand Lodge means by years of service. Drives the anniversaries widget and /api/cron/anniversaries.';

-- The anniversary job asks "whose raising falls in this month" across
-- one lodge. Postgres cannot use a plain b-tree index for a query on
-- extract(month from ...), so the index is built on the expression the
-- query actually uses.
create index if not exists idx_tenant_members_raised_month
  on public.tenant_members (tenant_id, (extract(month from raised_date)))
  where raised_date is not null;

-- ── Remembering who has already been congratulated ──
--
-- The cron runs daily and would otherwise send the same fiftieth-year
-- letter every day for a month. One row per brother per milestone,
-- with a unique constraint doing the remembering rather than a
-- timestamp column somebody has to reason about.

create table if not exists public.milestone_notices (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,
  -- 'anniversary' for the yearly note, or the milestone year as text
  -- ('25', '50', '60') for a service award.
  kind text not null,
  -- The year the notice was FOR, so next year's sends again.
  year int not null,
  unique (tenant_id, member_id, kind, year)
);

comment on table public.milestone_notices is
  'One row per brother per milestone per year, written after a notice is sent. The unique constraint is what stops a daily cron sending the same fiftieth-year letter thirty times — an insert that violates it means it has already gone out.';

alter table public.milestone_notices enable row level security;

drop policy if exists "Milestone notices visible to lodge admins" on public.milestone_notices;
create policy "Milestone notices visible to lodge admins" on public.milestone_notices for select
  using (public.is_tenant_admin(tenant_id));

drop policy if exists "Milestone notices writable by lodge admins" on public.milestone_notices;
create policy "Milestone notices writable by lodge admins" on public.milestone_notices for all
  using (public.is_tenant_admin(tenant_id));

-- ============================================================
-- >>> 029_visiting_brethren.sql
-- ============================================================

-- ============================================================
-- 029: The visitors' column of the Tyler's register
-- ============================================================
--
-- attendance rows key off member_id -> profiles(id), so only a brother
-- ON THIS ROSTER could be recorded as present. A visiting brother from
-- another lodge could not be recorded at all — not as present, not as
-- anything. The register has had a column for him for three hundred
-- years and the app had nowhere to put him.
--
-- This is not a rounding error in the attendance figures. Visitation is
-- lodge business: knowing who came, from where, and reciprocating is
-- half of what keeps neighbouring lodges in relation to one another.
-- A District Deputy's official visit is a matter of record. And the
-- minutes of a stated communication traditionally NAME the visitors,
-- which the minutes drafted by this app could not do.
--
-- WHY NOT A profiles ROW. The obvious shortcut is to create a profile
-- for each visitor and reuse attendance. That would be wrong twice
-- over: it would create login-capable accounts for men who are not
-- members here, and profiles is GLOBAL in this schema, so a visitor
-- typed in by one lodge would appear in another's namespace. A visitor
-- is a name written in a book on one evening, not an account.
--
-- No unique constraint on the name. Two men called John Smith may visit
-- the same lodge, and a register that refuses the second one is worse
-- than a register with a duplicate. The signing officer is the check.
--
-- SAFE TO RE-RUN.

create table if not exists public.event_visitors (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  event_id uuid references public.lodge_events(id) on delete cascade not null,

  name text not null,
  -- Free text, both of them. A visitor says "Corinthian 45" or
  -- "Prince Hall Lodge No. 6, Ohio" and the register writes down what
  -- he said; there is no directory of the world's lodges to validate
  -- against, and inventing one would only reject correct answers.
  visiting_from text,
  jurisdiction text,

  -- Optional, because a visitor is not asked to prove anything beyond
  -- what the Tyler already satisfied himself of at the door.
  title text,
  notes text,

  signed_in_by uuid references public.profiles(id)
);

comment on table public.event_visitors is
  'Visiting brethren present at a meeting — the visitors'' column of the Tyler''s register. Deliberately NOT profiles + attendance rows: that would mint login-capable accounts for non-members, and profiles is global to the platform, so one lodge''s visitor would surface in another''s namespace. A visitor is a name written in a book on one evening.';

comment on column public.event_visitors.visiting_from is
  'His own lodge, as he gives it — "Corinthian #45". Free text on purpose: there is no directory of the world''s lodges to validate against, and a constraint here would only reject correct answers.';

alter table public.event_visitors enable row level security;

-- Visible to the whole lodge. Who visited is read out in open lodge and
-- printed in the minutes; it is not administrative data.
drop policy if exists "Visitors visible to lodge members" on public.event_visitors;
create policy "Visitors visible to lodge members" on public.event_visitors for select
  using (tenant_id in (select public.get_user_tenant_ids()));

-- Signing the register is meeting work, which is the same tier that
-- records attendance — is_tenant_admin() since migration 022 covers
-- wardens and deacons, and the Junior Deacon is frequently the man
-- actually holding the book.
drop policy if exists "Visitors recordable by officers" on public.event_visitors;
create policy "Visitors recordable by officers" on public.event_visitors for all
  using (public.is_tenant_admin(tenant_id));

create index if not exists idx_event_visitors_event
  on public.event_visitors (tenant_id, event_id);

-- ============================================================
-- >>> 030_meeting_minutes.sql
-- ============================================================

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

commit;
