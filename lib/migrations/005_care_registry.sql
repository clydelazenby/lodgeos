-- ============================================================
-- MIGRATION: sickness, distress & widows care registry
-- Run against an already-provisioned database.
--
-- No existing table covers this. A brother goes into the hospital and
-- the lodge finds out three weeks later by accident. A widow the lodge
-- is obligated to care for isn't on any roster once her husband's
-- membership row goes inactive. This is the gap: nothing in the app
-- tracks who needs checking on, or logs that someone actually did.
--
-- Deliberately NOT modeled as a subtype of tenant_members, because a
-- widow is very often not herself a member (never was, or her husband's
-- membership ended at his death) — forcing her into tenant_members
-- would mean either fabricating a fake membership row for someone who
-- was never a Mason, or leaving widows unrepresented entirely. A
-- separate table with an OPTIONAL link to tenant_members handles both
-- cases honestly: a sick Brother (linked to his real member row) and a
-- widow with no member row of her own (tracked by name only) are both
-- first-class entries here.
-- ============================================================

create table if not exists public.care_entries (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,

  -- Optional link to an actual member — null for a widow who was never
  -- herself a member, or whose late husband's row has since gone inactive.
  member_id uuid references public.profiles(id) on delete set null,

  -- Used when member_id is null, or to keep the name current even when
  -- linked (a member's own profile name is the source of truth if
  -- member_id is set, but this avoids a join just to render a list).
  person_name text not null,
  relationship text, -- e.g. "Widow of Bro. Ellis", "Self", "Spouse" — free text, deliberately not an enum since real relationships don't fit a short fixed list

  care_type text check (care_type in ('sickness', 'distress', 'widow', 'other')) default 'other',

  status text check (status in ('open', 'monitoring', 'resolved')) default 'open',

  summary text, -- brief, non-clinical description — this is a lodge care log, not a medical record; see RLS note below on why detail is kept light
  contact_phone text,
  contact_address text,

  assigned_to uuid references public.profiles(id), -- typically the Chaplain, but not hard-coded to that office — any officer can be assigned

  last_checked_in_at timestamptz,
  check_in_interval_days int default 14, -- how often a check-in reminder should fire; Chaplain-configurable per entry, not a fixed global cadence

  created_by uuid references public.profiles(id)
);

comment on table public.care_entries is
  'Sickness, distress, and widow care tracking. Optionally linked to a real member via member_id; widows and other non-members are tracked by name only. Deliberately kept to light, non-clinical summaries — see RLS policy for why this table has narrower read access than most.';

create table if not exists public.care_checkins (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  care_entry_id uuid references public.care_entries(id) on delete cascade not null,
  checked_in_by uuid references public.profiles(id),
  note text
);

comment on table public.care_checkins is
  'Log of actual check-ins against a care_entries row — the answer to "did anyone actually call her," not just a reminder that one was due.';

alter table public.care_entries enable row level security;
alter table public.care_checkins enable row level security;

-- Narrower visibility than most tables in this schema, deliberately.
-- A sickness/distress list is sensitive in a way a dues ledger isn't —
-- broad readability by every officer tier (which is how most tables in
-- this app work) isn't the right default here. Visible to admin-tier
-- roles and to whoever is specifically assigned to an entry, not to
-- every Deacon/Warden by default. If a lodge wants broader visibility,
-- that's a deliberate future policy change, not this migration's
-- default.
create policy "Care entries visible to admins and assignee" on public.care_entries for select
  using (
    is_tenant_admin(tenant_id)
    or assigned_to = auth.uid()
  );

create policy "Care entries manageable by admins" on public.care_entries for all
  using (is_tenant_admin(tenant_id));

create policy "Care checkins visible with parent entry" on public.care_checkins for select
  using (
    care_entry_id in (
      select id from public.care_entries
      where is_tenant_admin(tenant_id) or assigned_to = auth.uid()
    )
  );

create policy "Care checkins manageable by admins" on public.care_checkins for all
  using (
    care_entry_id in (select id from public.care_entries where is_tenant_admin(tenant_id))
  );
