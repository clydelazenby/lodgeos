-- ============================================================
-- 038: Telling the officers when the roster changes
-- ============================================================
--
-- Three things happen to a man's membership that somebody ought to
-- hear about without having to go and look:
--
--   member.invited        an invitation went out, and to which address
--   member.first_signin   he actually got in — the only proof the
--                         invitation worked
--   member.removed        he came off the roster, and why
--
-- THE SECOND ONE IS THE POINT. An invitation that silently fails is
-- invisible: the Secretary believes the brother has been added, the
-- brother never saw the email, and nobody finds out until he turns up
-- at a meeting unable to sign in. "He signed in" is the only event that
-- proves the whole chain worked, and it is the one nothing reported.
--
-- WHO HEARS, BY DEFAULT: the administrative office (admin, secretary,
-- grand master) by TIER, plus the Worshipful Master and the Senior
-- Warden by OFFICE.
--
-- Why by office for those two: tenant_role cannot tell a Senior Warden
-- from a Junior one — both sit on 'warden' — and it cannot tell the
-- Master from a Warden the lodge has put on his tier. lodge_role holds
-- the exact chair. This is the same distinction migration 036 drew, and
-- it means these notices follow the CHAIR through the annual handover
-- rather than following the man out of it.
--
-- AND ANYONE MAY TURN THEIR OWN OFF. A notification nobody can stop is
-- one people filter to a folder they never open, which is worse than
-- not sending it: it teaches them to ignore the channel you will
-- eventually need. A row here overrules the default in either
-- direction, so an officer can also be ADDED who no rule covers.
--
-- NO ROW MEANS THE DEFAULT, exactly as in 035 and 036.
--
-- SAFE TO RE-RUN.

create table if not exists public.notification_preferences (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  tenant_id uuid references public.tenants(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,

  -- Kept in step with ROSTER_EVENTS in lib/notifications.ts.
  event_type text not null check (event_type in (
    'member.invited', 'member.first_signin', 'member.removed'
  )),

  enabled boolean not null
);

comment on table public.notification_preferences is
  'Who hears about roster changes. NO ROW means the default: the administrative tier, plus the Worshipful Master and Senior Warden by office. A row overrules that either way — anyone may switch his own off, and anyone may be added.';

create unique index if not exists idx_notification_prefs_unique
  on public.notification_preferences (tenant_id, member_id, event_type);

create index if not exists idx_notification_prefs_tenant
  on public.notification_preferences (tenant_id);

alter table public.notification_preferences enable row level security;

drop policy if exists "Own notification preferences visible" on public.notification_preferences;
create policy "Own notification preferences visible" on public.notification_preferences for select
  using (member_id = auth.uid());

drop policy if exists "Notification preferences visible to officers" on public.notification_preferences;
create policy "Notification preferences visible to officers" on public.notification_preferences for select
  using (public.is_tenant_admin(tenant_id));

-- A man may always silence his own. Unlike a permission — which he must
-- never be able to grant himself — turning off his own email can only
-- ever reduce what he receives, so there is nothing here to escalate.
drop policy if exists "Own notification preferences editable" on public.notification_preferences;
create policy "Own notification preferences editable" on public.notification_preferences for all
  using (member_id = auth.uid());

drop policy if exists "Notification preferences set by senior officers" on public.notification_preferences;
create policy "Notification preferences set by senior officers" on public.notification_preferences for all
  using (public.can_set_permissions(tenant_id));

-- ------------------------------------------------------------
-- Proof that an invitation worked
-- ------------------------------------------------------------
--
-- On tenant_members rather than profiles because it answers a LODGE's
-- question — "did the man we invited ever get in?" — and a brother who
-- later joins a second lodge has not, from that lodge's point of view,
-- signed in before.
--
-- Set once and never cleared. It is a record of an event, not a
-- session flag: overwriting it on a later sign-in would destroy the one
-- fact it exists to hold.
alter table public.tenant_members
  add column if not exists first_signin_at timestamptz;

comment on column public.tenant_members.first_signin_at is
  'When this brother first reached the app for this lodge. Set once, never cleared — it is the only proof an invitation actually worked. Null means he has never been in.';

-- Reading "who has never signed in" is a roster question the Members
-- page will want to answer, and it is a small partial index.
create index if not exists idx_members_never_signed_in
  on public.tenant_members (tenant_id)
  where first_signin_at is null;
