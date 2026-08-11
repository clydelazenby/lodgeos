-- ============================================================
-- 041: What each chair is responsible for
-- ============================================================
--
-- A brother appointed Junior Steward in December has no way to find
-- out what he has just agreed to do. The lodge knows; it is in the
-- heads of the men who have done it, and in a Grand Lodge manual
-- nobody has a copy of. So the office is filled and the duties are
-- learned by watching, slowly, or not at all.
--
-- DEFAULTS IN CODE, EDITS IN THE DATABASE. lib/duties.ts ships a plain
-- description of all seventeen offices so a lodge that has never
-- touched this still sees something useful the first time somebody
-- asks. This table holds only what a lodge has WRITTEN FOR ITSELF.
--
-- That matters more here than elsewhere: duties differ by jurisdiction
-- and by a lodge's own bylaws, and nothing shipped in an application
-- is an authority on what the Grand Lodge of North Carolina expects.
-- The shipped text is a starting point and the page says so.
--
-- NO ROW MEANS THE DEFAULT, and "reset" deletes the row rather than
-- copying the default into it — the same rule as 035, 036 and 038, and
-- for the same reason: a stored copy of today's default silently stops
-- tracking it.
--
-- READ BY EVERY BROTHER. This is not officers' business kept from the
-- craft; a man ought to be able to read what the Tyler does without
-- asking permission. Writing it is the administrative tier plus the
-- Master's and Senior Warden's chairs.
--
-- SAFE TO RE-RUN.

create table if not exists public.office_duties (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  tenant_id uuid references public.tenants(id) on delete cascade not null,

  -- Matched verbatim against tenant_members.lodge_role, as in 036.
  lodge_role text not null check (length(trim(lodge_role)) > 0),

  -- Non-empty by constraint: an office described as "" is not an edit,
  -- it is a reset, and a reset deletes the row.
  duties text not null check (length(trim(duties)) > 0),

  updated_by uuid,
  updated_by_name text
);

comment on table public.office_duties is
  'What a lodge says each of its offices is responsible for. NO ROW means the default text in lib/duties.ts applies — resetting deletes the row rather than copying the default in, so the default keeps tracking. Readable by every brother; written by the administrative tier plus the Master and Senior Warden by office.';

create unique index if not exists idx_office_duties_unique
  on public.office_duties (tenant_id, lodge_role);

alter table public.office_duties enable row level security;

drop policy if exists "Duties visible to the lodge" on public.office_duties;
create policy "Duties visible to the lodge" on public.office_duties for select
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_id = office_duties.tenant_id
      and user_id = auth.uid()
      and is_active = true
    )
  );

create or replace function public.can_edit_duties(p_tenant_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id
    and user_id = auth.uid()
    and is_active = true
    and (
      tenant_role in ('admin', 'secretary', 'grand_master')
      or trim(coalesce(lodge_role, '')) in ('Worshipful Master', 'Senior Warden')
    )
  );
$$;

comment on function public.can_edit_duties(uuid) is
  'The administrative tier, plus the Master and Senior Warden by office. Kept in step with canEditDuties() in lib/duties.ts — the route is the real gate; this backs it for anything reaching PostgREST directly.';

drop policy if exists "Duties written by senior officers" on public.office_duties;
create policy "Duties written by senior officers" on public.office_duties for all
  using (public.can_edit_duties(tenant_id));
