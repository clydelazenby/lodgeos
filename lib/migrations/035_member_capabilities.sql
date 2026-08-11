-- ============================================================
-- 035: Permissions for one brother, not just for his tier
-- ============================================================
--
-- Until now what a brother could do was decided entirely by his
-- tenant_role. Eight tiers, and every man on a tier got exactly the
-- same set of tools. That is right most of the time and wrong in the
-- cases lodges actually run into:
--
--   - The Junior Deacon keeps the document library. He is on the
--     'deacon' tier, which cannot upload a file.
--   - The Master wants the Chaplain, an ordinary member, to be able to
--     send the sick-and-distressed notice — and nothing else.
--   - A Warden is standing in as Treasurer for three months.
--   - A Secretary is winding down and should keep the books but stop
--     inviting brothers.
--
-- The alternative each time is to promote the man a whole tier, which
-- hands him six things to fix one. This table is the fix: a per-brother
-- EXCEPTION to his tier's defaults, in either direction.
--
--   granted = true   he has this capability even though his tier does
--                    not grant it
--   granted = false  he does NOT have it even though his tier does
--
-- NO ROW MEANS NO EXCEPTION. The absence of a row is not a denial — it
-- means "whatever his tier says", which is why granted is NOT NULL and
-- an exception that matches the tier default is deleted rather than
-- stored. The tier remains the rule; this is the amendment to it.
--
-- WHERE THIS IS ENFORCED. lib/auth/capabilities.ts reads these rows and
-- requireCapability() in the API routes is what actually refuses the
-- request. lib/auth/permissions.ts applies the same rules in the
-- browser so the interface stops offering tools the server would then
-- refuse — that half is presentation and is not a boundary, exactly as
-- its header has always said.
--
-- SAFE TO RE-RUN.

create table if not exists public.member_capabilities (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  tenant_id uuid references public.tenants(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,

  -- Kept in step with the Capability union in lib/auth/permissions.ts.
  -- A constraint rather than a lookup table because the list is the
  -- application's own vocabulary — a capability nothing in the code
  -- checks would be a row that grants nothing, and this makes that
  -- unwritable rather than merely useless.
  capability text not null check (capability in (
    'finance', 'communications', 'roster', 'documents',
    'events', 'meetings', 'settings', 'insight', 'assignments'
  )),

  granted boolean not null,

  -- Who made the exception, denormalised for the same reason as
  -- audit_log.actor_name: the record must outlive the officer, and
  -- lodges change officers every year.
  set_by uuid,
  set_by_name text,

  -- Why. Optional, and worth having: "covering the Treasurer's chair
  -- until December" is the difference between a permission somebody can
  -- review next year and one nobody dares touch.
  note text
);

comment on table public.member_capabilities is
  'Per-brother exceptions to what his tenant_role grants. granted=true adds a capability his tier lacks; granted=false takes away one his tier has. NO ROW means no exception — the tier default applies. Enforced server-side by requireCapability() in lib/auth/capabilities.ts.';

comment on column public.member_capabilities.granted is
  'true = grant beyond the tier, false = revoke from the tier. Never null: a row exists only to overrule the tier, and an exception matching the default is deleted rather than stored.';

-- One answer per brother per capability. Two rows saying opposite
-- things about the same man is a question nobody can answer.
create unique index if not exists idx_member_capabilities_unique
  on public.member_capabilities (tenant_id, member_id, capability);

-- Read on every guarded request, always by this exact pair.
create index if not exists idx_member_capabilities_member
  on public.member_capabilities (tenant_id, member_id);

alter table public.member_capabilities enable row level security;

-- ------------------------------------------------------------
-- Who may CHANGE a permission
-- ------------------------------------------------------------
--
-- Deliberately NOT is_tenant_admin(). That function is true for every
-- officer down to a Deacon, and a table whose whole purpose is handing
-- out privilege must not be writable by everyone whose privilege it can
-- extend — a Deacon could otherwise grant himself 'finance' with one
-- PostgREST call and never touch the interface.
--
-- This mirrors the 'settings' capability's tier list exactly. It is a
-- fixed tier check on purpose: reading member_capabilities to decide who
-- may write member_capabilities would let a granted 'settings' exception
-- widen the very gate that issued it.
create or replace function public.can_set_permissions(p_tenant_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id
    and user_id = auth.uid()
    and tenant_role in ('admin', 'secretary', 'grand_master')
    and is_active = true
  );
$$;

comment on function public.can_set_permissions(uuid) is
  'Fixed tier check — admin, secretary, grand master. Deliberately not is_tenant_admin(), which includes deacons, and deliberately not derived from member_capabilities itself, which would let a granted exception widen the gate that issued it.';

-- A brother may see what he has been given or had taken away. Being
-- told "the Secretary turned this off for you" is the difference
-- between a permission and a bug report.
drop policy if exists "Own capabilities visible" on public.member_capabilities;
create policy "Own capabilities visible" on public.member_capabilities for select
  using (member_id = auth.uid());

-- Officers see the whole picture, because the profile page that shows
-- it is theirs and reviewing who holds what is the point.
drop policy if exists "Capabilities visible to officers" on public.member_capabilities;
create policy "Capabilities visible to officers" on public.member_capabilities for select
  using (public.is_tenant_admin(tenant_id));

drop policy if exists "Capabilities set by senior officers" on public.member_capabilities;
create policy "Capabilities set by senior officers" on public.member_capabilities for all
  using (public.can_set_permissions(tenant_id));
