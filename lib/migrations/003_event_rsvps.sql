-- ============================================================
-- MIGRATION: event calendar invites + RSVP tracking
-- Run against an already-provisioned database.
-- ============================================================

create table if not exists public.event_rsvps (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  event_id uuid references public.lodge_events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  response text check (response in ('yes','no','maybe')) not null,
  responded_at timestamptz default now(),
  rsvp_token uuid default gen_random_uuid() not null,
  unique(event_id, user_id)
);

comment on table public.event_rsvps is
  'RSVP responses to lodge_events, driven by one-tap links in calendar invite emails. Powers the attendee headcount shown on the events page.';

alter table public.event_rsvps enable row level security;

create policy "RSVPs visible to lodge members" on public.event_rsvps for select
  using (
    event_id in (
      select id from public.lodge_events
      where tenant_id in (select get_user_tenant_ids())
    )
  );

-- Writes to event_rsvps only happen through the service-role client in
-- /api/rsvp (public, token-authenticated route). No general
-- insert/update policy is added here on purpose.
