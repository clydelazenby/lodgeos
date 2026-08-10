-- ============================================================
-- 022: Grand Master tier
-- ============================================================
--
-- The Grand Master presides over the Grand Lodge, not over any one
-- lodge — but when he visits or inspects one, he outranks every
-- officer in it, and there was no way to record that. The only place
-- to put him was the free-text lodge_role field, which grants nothing.
--
-- He is NOT a degree. Grand Master is an office; the degree dropdown
-- (lib/degrees.ts) describes what a brother has taken, not what chair
-- he sits in. This goes where the other offices live.
--
-- ACCESS: full, equal to admin and secretary. That is a deliberate
-- choice — see the escalation note below, because a tier this broad
-- must not be assignable by someone who does not already hold it.
--
-- is_tenant_admin() is widened too, not just the app-layer guards.
-- Migration 004 already made that function mean "has administrative
-- access of SOME kind" rather than literally 'admin', and it is what
-- every RLS policy keys off. Leaving it out would produce exactly the
-- failure 004 warned about: routes approving a write that the database
-- then silently refuses.
--
-- SAFE TO RE-RUN.

alter table public.tenant_members
  drop constraint if exists tenant_members_tenant_role_check;

alter table public.tenant_members
  add constraint tenant_members_tenant_role_check
  check (tenant_role in (
    'admin', 'secretary', 'grand_master', 'worshipful_master',
    'treasurer', 'warden', 'deacon', 'member'
  ));

comment on column public.tenant_members.tenant_role is
  'Permission tier, not necessarily the exact office title (see lodge_role for that). secretary/admin/grand_master: full access. worshipful_master: full meetings/events/communications, read-only finances. treasurer: full finances, read-only roster. warden: meetings/attendance/roster-read (covers Senior+Junior Warden). deacon: attendance/degree-progress focus (covers Senior+Junior Deacon). member: portal only.';

-- Every RLS policy on the lodge's tables routes through this.
create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id
    and user_id = auth.uid()
    and tenant_role in (
      'admin', 'secretary', 'grand_master', 'worshipful_master',
      'treasurer', 'warden', 'deacon'
    )
    and is_active = true
  );
$$;

-- ESCALATION NOTE, enforced in app/api/members/invite and
-- app/api/members/import rather than here: 'grand_master' now counts as
-- an ADMIN-TIER role. A Worshipful Master can invite brothers, and
-- without that guard he could invite one as Grand Master — or, more to
-- the point, hand full administrative access to an account he
-- controls. Only an existing admin, secretary or grand master may
-- assign it.
