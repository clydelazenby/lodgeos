-- ============================================================
-- 029: The visitors' column of the Tyler's register
-- ============================================================
--
-- attendance rows key off member_id -> profiles(id), so only a brother
-- ON THIS ROSTER could be recorded as present. A visiting brother from
-- another lodge could not be recorded at all — not as present, not as
-- anything. The register has had a column for him for three hundred
-- years and the app had nowhere to put him.
--
-- This is not a rounding error in the attendance figures. Visitation is
-- lodge business: knowing who came, from where, and reciprocating is
-- half of what keeps neighbouring lodges in relation to one another.
-- A District Deputy's official visit is a matter of record. And the
-- minutes of a stated communication traditionally NAME the visitors,
-- which the minutes drafted by this app could not do.
--
-- WHY NOT A profiles ROW. The obvious shortcut is to create a profile
-- for each visitor and reuse attendance. That would be wrong twice
-- over: it would create login-capable accounts for men who are not
-- members here, and profiles is GLOBAL in this schema, so a visitor
-- typed in by one lodge would appear in another's namespace. A visitor
-- is a name written in a book on one evening, not an account.
--
-- No unique constraint on the name. Two men called John Smith may visit
-- the same lodge, and a register that refuses the second one is worse
-- than a register with a duplicate. The signing officer is the check.
--
-- SAFE TO RE-RUN.

create table if not exists public.event_visitors (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  event_id uuid references public.lodge_events(id) on delete cascade not null,

  name text not null,
  -- Free text, both of them. A visitor says "Corinthian 45" or
  -- "Prince Hall Lodge No. 6, Ohio" and the register writes down what
  -- he said; there is no directory of the world's lodges to validate
  -- against, and inventing one would only reject correct answers.
  visiting_from text,
  jurisdiction text,

  -- Optional, because a visitor is not asked to prove anything beyond
  -- what the Tyler already satisfied himself of at the door.
  title text,
  notes text,

  signed_in_by uuid references public.profiles(id)
);

comment on table public.event_visitors is
  'Visiting brethren present at a meeting — the visitors'' column of the Tyler''s register. Deliberately NOT profiles + attendance rows: that would mint login-capable accounts for non-members, and profiles is global to the platform, so one lodge''s visitor would surface in another''s namespace. A visitor is a name written in a book on one evening.';

comment on column public.event_visitors.visiting_from is
  'His own lodge, as he gives it — "Corinthian #45". Free text on purpose: there is no directory of the world''s lodges to validate against, and a constraint here would only reject correct answers.';

alter table public.event_visitors enable row level security;

-- Visible to the whole lodge. Who visited is read out in open lodge and
-- printed in the minutes; it is not administrative data.
create policy "Visitors visible to lodge members" on public.event_visitors for select
  using (tenant_id in (select public.get_user_tenant_ids()));

-- Signing the register is meeting work, which is the same tier that
-- records attendance — is_tenant_admin() since migration 022 covers
-- wardens and deacons, and the Junior Deacon is frequently the man
-- actually holding the book.
create policy "Visitors recordable by officers" on public.event_visitors for all
  using (public.is_tenant_admin(tenant_id));

create index if not exists idx_event_visitors_event
  on public.event_visitors (tenant_id, event_id);
