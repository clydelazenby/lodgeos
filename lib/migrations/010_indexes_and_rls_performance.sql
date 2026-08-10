-- ============================================================
-- 010: Indexes + RLS evaluation performance
-- ============================================================
--
-- Two independent problems, fixed together because they compound
-- each other badly.
--
-- PROBLEM 1 — no indexes existed anywhere.
-- Neither schema.sql nor migrations 002-009 contained a single
-- `create index`. Primary keys and `unique(...)` constraints get
-- indexes automatically, which is why some access paths were already
-- fine, but Postgres does NOT index foreign-key columns. Nine tables
-- carry a `tenant_id` FK that essentially every query in the app
-- filters on, and none of them were indexed.
--
-- Note which lookups were ALREADY covered, so the indexes below don't
-- duplicate them:
--   tenant_members  unique(tenant_id, user_id)         -> tenant_id-leading OK
--   attendance      unique(event_id, member_id)        -> event_id-leading OK
--   degree_progress unique(tenant_id, member_id, degree) -> tenant_id-leading OK
--   event_rsvps     unique(event_id, user_id)          -> event_id-leading OK
--   tenants         unique(slug)                       -> slug lookup OK
--   platform_subscriptions unique(tenant_id)           -> tenant_id OK
-- A multi-column index only serves lookups on a LEFT-most prefix of its
-- columns, so `unique(tenant_id, user_id)` does nothing for a query
-- filtering on user_id alone — which is exactly what the hottest query
-- in the app does. That gap is the first index below.
--
-- PROBLEM 2 — the three RLS helper functions were VOLATILE.
-- `language sql` defaults to VOLATILE when no volatility marker is
-- given. A VOLATILE function cannot be cached within a statement or
-- inlined into the query plan, so Postgres re-executes it ONCE PER ROW
-- SCANNED. Every RLS policy in this schema routes through one of these
-- three functions, so a query returning 200 members ran the membership
-- subquery 200 times — each one an unindexed sequential scan, per
-- problem 1.
--
-- Marking them STABLE tells Postgres the result cannot change within a
-- single statement, which is true: they depend only on auth.uid() and
-- table contents, neither of which shifts mid-statement. This is the
-- correct marker (not IMMUTABLE — the result does depend on database
-- state, it just doesn't change during one statement).
--
-- SAFE TO RE-RUN. Every statement is idempotent.
--
-- Note on locking: these are plain (non-CONCURRENT) index builds, which
-- take a brief write lock per table. At current data volumes that is
-- milliseconds. If this is ever run against a lodge with a very large
-- history, switch to `create index concurrently` — but note that
-- CONCURRENTLY cannot run inside a transaction block, so each statement
-- would then need to be run individually rather than pasting the file.

-- ============================================================
-- PART 1: INDEXES
-- ============================================================

-- THE IMPORTANT ONE. get_user_tenant_ids() runs on effectively every
-- authenticated request, via nearly every RLS policy in the schema. It
-- selects tenant_id filtered by user_id + is_active — none of which the
-- existing unique(tenant_id, user_id) index can serve, because
-- tenant_id is not being filtered on. Including tenant_id as a trailing
-- column makes this an index-only scan: Postgres answers the function
-- entirely from the index without touching the table at all.
create index if not exists idx_tenant_members_user_active
  on public.tenant_members (user_id, tenant_id)
  where is_active = true;

-- is_tenant_admin() filters tenant_id + user_id + tenant_role + active.
-- The tenant_id/user_id part is already served by the unique
-- constraint; this partial index narrows straight to the officer rows,
-- which are a tiny fraction of any lodge's membership.
create index if not exists idx_tenant_members_admins
  on public.tenant_members (tenant_id, tenant_role)
  where is_active = true;

-- Events: every lodge page filters tenant_id and orders/filters by
-- event_date (upcoming events, year-to-date attendance, heatmaps).
create index if not exists idx_lodge_events_tenant_date
  on public.lodge_events (tenant_id, event_date desc);

-- Attendance: event_id-leading is covered by unique(event_id,
-- member_id). These two are not — the dashboard heatmap scans a
-- tenant's whole year, and member profiles scan one member's history.
create index if not exists idx_attendance_tenant
  on public.attendance (tenant_id);
create index if not exists idx_attendance_member
  on public.attendance (member_id);

-- Payments: dues pages filter by tenant, member portal filters by
-- member, and both narrow on status.
create index if not exists idx_payments_tenant_status
  on public.payments (tenant_id, status);
create index if not exists idx_payments_member
  on public.payments (member_id);

-- Degree progress: tenant_id-leading is covered by the unique
-- constraint. Per-member lookup (member profile page) is not.
create index if not exists idx_degree_progress_member
  on public.degree_progress (member_id);

-- Straightforward tenant-scoped tables with no covering index at all.
create index if not exists idx_documents_tenant
  on public.documents (tenant_id);
create index if not exists idx_communications_tenant
  on public.communications (tenant_id);
create index if not exists idx_petitions_tenant_status
  on public.petitions (tenant_id, status);

-- Migration 003/005/008 tables, same gap.
create index if not exists idx_event_rsvps_user
  on public.event_rsvps (user_id);
create index if not exists idx_care_entries_tenant
  on public.care_entries (tenant_id);
create index if not exists idx_care_checkins_entry
  on public.care_checkins (care_entry_id);
create index if not exists idx_meeting_agenda_event
  on public.meeting_agenda_items (event_id);

-- ============================================================
-- PART 2: RLS HELPER VOLATILITY
-- ============================================================

alter function public.get_user_tenant_ids() stable;
alter function public.is_tenant_admin(uuid) stable;
alter function public.is_super_admin() stable;

-- ============================================================
-- PART 3: HOIST auth.uid() OUT OF PER-ROW EVALUATION
-- ============================================================
--
-- A bare `auth.uid()` in a policy is re-evaluated per row for the same
-- reason the helpers were: it is not a constant the planner can hoist.
-- Wrapping it as `(select auth.uid())` turns it into an InitPlan —
-- evaluated exactly once per statement, then compared against as a
-- constant. This is Supabase's own documented RLS performance guidance
-- and it changes evaluation cost only, never which rows match.
--
-- Only the policies that referenced auth.uid() DIRECTLY are rewritten
-- here. Policies that call the helper functions are already fixed by
-- Part 2 and are deliberately left untouched.

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select
  using (id = (select auth.uid()) or public.is_super_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update
  using (id = (select auth.uid()));

drop policy if exists "Profile created on signup" on public.profiles;
create policy "Profile created on signup" on public.profiles for insert
  with check (id = (select auth.uid()));

drop policy if exists "Own membership always visible" on public.tenant_members;
create policy "Own membership always visible" on public.tenant_members for select
  using (user_id = (select auth.uid()));

drop policy if exists "Own degree progress always visible" on public.degree_progress;
create policy "Own degree progress always visible" on public.degree_progress for select
  using (member_id = (select auth.uid()));

drop policy if exists "Own payments visible" on public.payments;
create policy "Own payments visible" on public.payments for select
  using (
    member_id = (select auth.uid())
    or public.is_tenant_admin(tenant_id)
    or public.is_super_admin()
  );

-- ============================================================
-- PART 4: REFRESH PLANNER STATISTICS
-- ============================================================
-- New indexes are useless until the planner knows the tables' shape
-- well enough to choose them. Autovacuum gets here eventually; this
-- makes the improvement apply to the very next query instead.

analyze public.tenant_members;
analyze public.lodge_events;
analyze public.attendance;
analyze public.payments;
analyze public.degree_progress;
analyze public.documents;
analyze public.communications;
analyze public.petitions;
analyze public.profiles;
