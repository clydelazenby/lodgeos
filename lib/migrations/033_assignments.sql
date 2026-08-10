-- ============================================================
-- 033: Giving a brother something to do
-- ============================================================
--
-- The lodge could describe a degree's work (031) and record that a
-- candidate had done a step, but it could not GIVE anyone anything. A
-- Worshipful Master asking a brother to look into the roof, a Secretary
-- putting a new candidate onto the Entered Apprentice plan — both
-- happened at a meeting, in speech, and were remembered or not.
--
-- TWO KINDS OF THING, ONE TABLE, and the difference is step_id:
--
--   step_id IS NULL     a plain task. The brother does it and marks it
--                       done himself, because nobody else can know when
--                       he has read the bylaws.
--
--   step_id IS NOT NULL a curriculum item. Its completion is NOT stored
--                       here — it lives in curriculum_progress, where an
--                       officer signs it off. Somebody else hearing it
--                       is the whole meaning of a proficiency, and a
--                       second completed_at on this row would be a
--                       second source of truth that could disagree with
--                       the first.
--
-- That asymmetry is deliberate and it is why completed_at is nullable
-- and unused for curriculum rows. lib/assignments.ts computes status
-- from both sources in one place so no page re-derives it differently.
--
-- WHY ASSIGN A CURRICULUM STEP AT ALL, when curriculum_steps already
-- lists it? Because a curriculum is what the DEGREE requires and an
-- assignment is what THIS BROTHER has been asked to do, by whom, by
-- when. A lodge may put one candidate on the full plan and another on
-- three steps at a time. The step says what; the assignment says who
-- and when.
--
-- SAFE TO RE-RUN.

create table if not exists public.assignments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,

  assigned_to uuid references public.profiles(id) on delete cascade not null,

  -- Not a foreign key, for the same reason as audit_log.actor_id: the
  -- record must outlive the officer who gave it, and lodges change
  -- officers every year.
  assigned_by uuid,
  assigned_by_name text,

  title text not null,
  description text,
  due_date date,

  -- Set when this assignment mirrors a step of a degree's curriculum.
  -- ON DELETE CASCADE: if the lodge deletes the step, an assignment to
  -- do a thing that no longer exists is noise, not history.
  step_id uuid references public.curriculum_steps(id) on delete cascade,

  -- Optional material, independent of the step's own document.
  document_id uuid references public.documents(id) on delete set null,

  -- Used only for plain tasks. Curriculum assignments read their
  -- completion from curriculum_progress; see the note above.
  completed_at timestamptz,

  -- A task withdrawn rather than finished. Kept, so "I was never asked"
  -- and "I was asked and it was called off" stay distinguishable.
  cancelled_at timestamptz,

  -- When the notification email went out. Null means it has not been
  -- sent — which is how a failed send stays visible rather than
  -- silently counting as delivered.
  notified_at timestamptz
);

comment on table public.assignments is
  'Work given to a brother: a plain task he completes himself, or a curriculum step whose completion lives in curriculum_progress and is signed off by an officer. The difference is step_id. Status is computed in lib/assignments.ts from both sources so no page re-derives it differently.';

comment on column public.assignments.completed_at is
  'Plain tasks ONLY. For a curriculum assignment (step_id set) completion lives in curriculum_progress, because an officer must sign it off — storing it here as well would be a second source of truth that could disagree.';

comment on column public.assignments.notified_at is
  'When the "you have been asked to..." email went out. Null means it has not — a failed send stays visibly unsent rather than being assumed delivered.';

alter table public.assignments enable row level security;

-- A brother sees what he has been given. He does not see what the
-- lodge has given anyone else — a list of who is behind on what is the
-- officers' business, not a leaderboard.
drop policy if exists "Own assignments visible" on public.assignments;
create policy "Own assignments visible" on public.assignments for select
  using (assigned_to = auth.uid());

drop policy if exists "Assignments visible to officers" on public.assignments;
create policy "Assignments visible to officers" on public.assignments for select
  using (public.is_tenant_admin(tenant_id));

-- He may mark his OWN plain task done. The route is what enforces that
-- a curriculum assignment cannot be self-completed; this policy governs
-- the row, and the update it permits is his own completed_at.
drop policy if exists "Own assignments updatable" on public.assignments;
create policy "Own assignments updatable" on public.assignments for update
  using (assigned_to = auth.uid());

drop policy if exists "Assignments managed by officers" on public.assignments;
create policy "Assignments managed by officers" on public.assignments for all
  using (public.is_tenant_admin(tenant_id));

-- The portal asks "what is open for me"; the officer page asks "what is
-- open in this lodge". Both are covered.
create index if not exists idx_assignments_member
  on public.assignments (tenant_id, assigned_to, completed_at);

create index if not exists idx_assignments_open
  on public.assignments (tenant_id, created_at desc)
  where completed_at is null and cancelled_at is null;

-- One assignment per brother per curriculum step. Putting a candidate
-- on the same plan twice must not give him the list twice.
create unique index if not exists idx_assignments_unique_step
  on public.assignments (assigned_to, step_id)
  where step_id is not null;
