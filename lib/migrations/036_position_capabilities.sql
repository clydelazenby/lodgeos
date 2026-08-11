-- ============================================================
-- 036: Permissions that belong to the chair, not the man
-- ============================================================
--
-- 035 let a lodge give ONE brother an exception. That is the right tool
-- for "Bro. Powell keeps the library" and the wrong one for "the Junior
-- Deacon keeps the library", which is what a lodge actually decides.
--
-- The difference matters every December. Offices move at the annual
-- handover: a new Master, everyone shifts up a chair. With per-brother
-- exceptions alone, the Secretary must remember what each outgoing
-- officer had been given, take it off him, and put it on his successor
-- — for every office, every year, from memory. Miss one and a Past
-- Master keeps access he no longer has any business holding.
--
-- Attach it to the OFFICE and none of that happens. The Transition page
-- moves lodge_role from one brother to the next and the access moves
-- with it, because it was never his in the first place.
--
-- THREE LAYERS, MOST SPECIFIC WINS:
--
--   1. his tier          (tenant_role — the rule, in code)
--   2. his office        (this table — what the chair carries)
--   3. him personally    (035 — the exception to both)
--
-- and a platform administrator above all three. A brother with no
-- office simply skips layer 2. As in 035, NO ROW MEANS NO OPINION:
-- an office that says nothing about 'finance' leaves the answer to the
-- tier, which is not the same as denying it.
--
-- WHY lodge_role IS TEXT AND NOT A FOREIGN KEY. It already is text on
-- tenant_members, and lib/stations.ts is the list the dropdown and the
-- Lodge Room floor plan both read. A lodge that has typed an office
-- this app has never heard of keeps it — OfficeSelect preserves
-- unknown values on purpose — and this table must be able to describe
-- that office too rather than refusing the only name the lodge uses.
--
-- SAFE TO RE-RUN.

create table if not exists public.position_capabilities (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  tenant_id uuid references public.tenants(id) on delete cascade not null,

  -- Matched against tenant_members.lodge_role exactly, the same way the
  -- Lodge Room seats a brother. Trimmed and non-empty: "no office" is
  -- the absence of a row, never a row keyed on ''.
  lodge_role text not null check (length(trim(lodge_role)) > 0),

  capability text not null check (capability in (
    'finance', 'communications', 'roster', 'documents',
    'events', 'meetings', 'settings', 'insight', 'assignments'
  )),

  granted boolean not null,

  set_by uuid,
  set_by_name text
);

comment on table public.position_capabilities is
  'What an OFFICE carries, independent of who holds it. Resolution is tier, then office (this table), then the per-brother exception in member_capabilities, with a platform admin above all three. NO ROW means the office has no opinion and the tier decides. Enforced server-side by requireCapability() in lib/auth/capabilities.ts.';

comment on column public.position_capabilities.lodge_role is
  'Matched verbatim against tenant_members.lodge_role, as lib/stations.ts spells it. Text rather than a foreign key because OfficeSelect deliberately preserves an office a lodge typed that this app does not know, and that office must be describable here too.';

-- One answer per office per capability.
create unique index if not exists idx_position_capabilities_unique
  on public.position_capabilities (tenant_id, lodge_role, capability);

-- Read on every guarded request, by tenant and office.
create index if not exists idx_position_capabilities_role
  on public.position_capabilities (tenant_id, lodge_role);

alter table public.position_capabilities enable row level security;

-- Any brother of the lodge may read what the chairs carry. This is the
-- lodge's own table of authority — the sort of thing read out at an
-- installation — and a man being able to see that the Junior Deacon
-- keeps the library is not a disclosure, it is the point.
drop policy if exists "Office capabilities visible to the lodge" on public.position_capabilities;
create policy "Office capabilities visible to the lodge" on public.position_capabilities for select
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_id = position_capabilities.tenant_id
      and user_id = auth.uid()
      and is_active = true
    )
  );

-- Written by the same fixed tier as member_capabilities, and for the
-- same reason: the gate that hands out privilege must not be reachable
-- through the privilege it hands out. can_set_permissions() is a tier
-- check that consults neither this table nor 035.
drop policy if exists "Office capabilities set by senior officers" on public.position_capabilities;
create policy "Office capabilities set by senior officers" on public.position_capabilities for all
  using (public.can_set_permissions(tenant_id));
