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

create policy "Milestone notices visible to lodge admins" on public.milestone_notices for select
  using (public.is_tenant_admin(tenant_id));

create policy "Milestone notices writable by lodge admins" on public.milestone_notices for all
  using (public.is_tenant_admin(tenant_id));
