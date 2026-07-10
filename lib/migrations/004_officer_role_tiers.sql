-- ============================================================
-- MIGRATION: officer role tiers
-- Run against an already-provisioned database.
--
-- BEFORE: tenant_role was a flat 3-value permission field
-- ('admin','secretary','member') completely separate from lodge_role
-- (a free-text DISPLAY label like "Worshipful Master" or "Senior
-- Deacon" with zero permission weight). A Junior Steward and a
-- Worshipful Master both sitting at tenant_role='member' had identical
-- access — the title on screen meant nothing to the system.
--
-- AFTER: tenant_role expands to real permission TIERS matching actual
-- lodge duties. lodge_role keeps doing its job as the free-text
-- display label ("Senior Warden" vs "Junior Warden" both map to the
-- 'warden' tier below, same access, different title shown on screen) —
-- this migration does not touch lodge_role at all.
--
-- Tiers chosen deliberately as ACCESS LEVELS, not one slot per named
-- office: Senior Warden and Junior Warden have the same practical
-- system permissions (meetings, attendance, roster-read), so forcing
-- them into separate permission tiers would mean duplicating every
-- permission check for no real difference in access. Where a lodge
-- has two Deacons or two Wardens, both get the same tier; lodge_role
-- free text is what distinguishes which specific office they hold.
-- ============================================================

-- Drop the old check constraint so existing rows aren't invalidated
-- mid-migration, then widen it to the new tier set.
alter table public.tenant_members drop constraint if exists tenant_members_tenant_role_check;

alter table public.tenant_members
  add constraint tenant_members_tenant_role_check
  check (tenant_role in ('secretary', 'worshipful_master', 'treasurer', 'warden', 'deacon', 'admin', 'member'));

comment on column public.tenant_members.tenant_role is
  'Permission tier, not necessarily the exact office title (see lodge_role for that). secretary/admin: full access. worshipful_master: full meetings/events/communications, read-only finances. treasurer: full finances, read-only roster. warden: meetings/attendance/roster-read (covers Senior+Junior Warden). deacon: attendance/degree-progress focus (covers Senior+Junior Deacon). member: portal only.';

-- Existing rows are untouched by this migration — 'admin', 'secretary',
-- and 'member' remain valid values, so no data needs backfilling. A
-- lodge adopting the new tiers does so by editing existing members'
-- tenant_role going forward (via the super admin dashboard or directly),
-- not through an automatic reassignment this migration would have to
-- guess at.

-- ============================================================
-- CRITICAL: update the RLS helper function
-- ============================================================
-- schema.sql's is_tenant_admin() function checks
-- `tenant_role in ('admin','secretary')` directly. Without this update,
-- a member sitting at tenant_role='treasurer' (or worshipful_master, or
-- warden, or deacon) would pass every application-layer permission
-- check in this codebase (requireTenantAdmin() is updated separately in
-- lib/auth/requireTenantAdmin.ts to know about the new tiers) but would
-- still be silently blocked by Postgres Row Level Security itself —
-- e.g. a Treasurer's own INSERT into a dues-related table would get
-- rejected by the database even though the API route approved the
-- request. That mismatch is the kind of bug that looks like "it works
-- in the route but nothing actually saves," which is confusing to
-- debug precisely because the failure is silent and one layer removed
-- from where the permission was granted.
create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id
    and user_id = auth.uid()
    and tenant_role in ('admin', 'secretary', 'worshipful_master', 'treasurer', 'warden', 'deacon')
    and is_active = true
  );
$$;

-- Note on scope: this function name is is_tenant_admin() but, after
-- this migration, it really means "has administrative-tier access of
-- SOME kind," not "is specifically an admin." Different tiers still get
-- different treatment at the application layer (requireTenantAdmin()
-- returns which tier the user holds, and routes/pages branch on that),
-- but at the database RLS layer, anyone in this list can pass a
-- write-gated policy. Fine-grained "a Treasurer can write dues rows but
-- not petition rows" enforcement lives in application code, not in this
-- one shared RLS function — see lib/auth/requireTenantAdmin.ts.

