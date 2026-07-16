-- ============================================================
-- MIGRATION: live meeting state (Meeting Mode)
-- Run against an already-provisioned database.
--
-- lodge_events has no concept of "is this meeting currently open," no
-- agenda-item tracking, and no running-timer state. Meeting Mode (the
-- reference image's live panel with a timer, an agenda checklist —
-- Opening, Roll Call, Reading of Minutes, Treasurer's Report,
-- Balloting, Unfinished Business, New Business, Closing — and a "Close
-- Lodge" button) genuinely needs server-persisted state, not
-- client-only React state that would vanish if the Secretary's laptop
-- sleeps or they switch tabs mid-meeting. This migration adds that.
-- ============================================================

alter table public.lodge_events
  add column if not exists opened_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists opened_by uuid references public.profiles(id);

comment on column public.lodge_events.opened_at is
  'Set when a Secretary/officer opens the lodge for this event via Meeting Mode. Null means the meeting has not been opened yet (or this event predates Meeting Mode entirely). The live timer displayed in Meeting Mode is derived from NOW() - opened_at, not stored as a separate ticking value, so it stays correct even across a page refresh or a different device loading the same meeting.';
comment on column public.lodge_events.closed_at is
  'Set when the lodge is formally closed via the "Close Lodge" action. A meeting with opened_at set and closed_at null is the one CURRENTLY in progress, if any — at most one such event should exist per tenant at a time, though this is enforced by application logic (only allowing one meeting to be opened at once), not a database constraint, since a hard constraint here would be more restrictive than a real edge case might need (e.g. correcting a mistakenly-left-open meeting).';

create table if not exists public.meeting_agenda_items (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  event_id uuid references public.lodge_events(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  label text not null,
  sort_order int not null default 0,
  completed boolean default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id),
  notes text -- e.g. "7 of 9 present" for Roll Call, "Report submitted" for Treasurer's Report — short freeform context, matching the reference image's per-item subtext
);

comment on table public.meeting_agenda_items is
  'Per-meeting checklist items for Meeting Mode. Rows are created when a meeting is opened, seeded from a standard agenda template (see DEFAULT_AGENDA in the Meeting Mode page) — not a fixed enum, so a lodge can add/remove/reorder items for a specific meeting (e.g. inserting "Degree Conferral" for a degree night) without a schema change.';

alter table public.meeting_agenda_items enable row level security;

create policy "Agenda items visible to lodge members" on public.meeting_agenda_items for select
  using (tenant_id in (select get_user_tenant_ids()));

create policy "Agenda items manageable by admins" on public.meeting_agenda_items for all
  using (is_tenant_admin(tenant_id));
