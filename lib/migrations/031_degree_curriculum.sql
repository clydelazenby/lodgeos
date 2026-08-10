-- ============================================================
-- 031: What a candidate does next, in order
-- ============================================================
--
-- The app had a document library and it had degree_progress, and
-- neither knew the other existed. The library is a flat list a
-- candidate has to interpret; degree_progress records that he was
-- conferred on a date and passed his proficiency on another, with
-- nothing in between. So "how is Bro. Reddick getting on?" could be
-- answered only as "no progress recorded in 45 days", which is a
-- symptom rather than an answer.
--
-- A folder says where a file lives. A CURRICULUM says what the man does
-- next, in what order, and how far along he is. That is the thing a
-- mentor actually needs and the thing a candidate actually wants.
--
-- PER LODGE, NOT GLOBAL. Jurisdictions differ on what is required, in
-- what order, and what is merely customary. A curriculum shipped as
-- platform-wide truth would be wrong for most lodges on the platform
-- and unarguable for all of them. Each lodge writes its own; the app
-- offers a conventional outline to start from and expects it to be
-- edited.
--
-- STEP TITLES ARE NOT RITUAL, and are visible to every member. A
-- candidate must be able to see the degree he is WORKING TOWARD — an
-- Entered Apprentice studying for his Fellowcraft needs the FC list —
-- so gating steps by degree would hide from him the one thing he is
-- trying to do. The DOCUMENTS behind the steps keep the degree floor
-- they already had (documents.access_level), which is where the actual
-- restriction belongs and where it was already enforced.
--
-- SAFE TO RE-RUN.

create table if not exists public.curriculum_steps (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,

  -- EA/FC/MM only. This tracks the candidate's progression through the
  -- Blue Lodge — the degrees this lodge itself confers — for the same
  -- reason degree_progress.degree is constrained that way (see 021).
  -- Appendant bodies are separate organisations with their own work.
  degree text not null check (degree in ('EA', 'FC', 'MM')),

  title text not null,
  description text,

  sort_order int not null default 0,

  -- The material for this step, when there is any. ON DELETE SET NULL
  -- and not CASCADE: deleting a superseded PDF must not silently delete
  -- the step "Learn the catechism" along with it.
  document_id uuid references public.documents(id) on delete set null,

  -- A step a candidate must complete, versus one the lodge offers.
  -- Only required steps count toward the progress figure.
  required boolean not null default true
);

comment on table public.curriculum_steps is
  'The ordered work of one degree, defined per lodge because jurisdictions differ on what is required and in what order. Steps may point at a document; the document keeps its own access_level floor, which is where degree restriction is enforced. Step titles themselves are visible to every member — a candidate must be able to see the degree he is working toward.';

comment on column public.curriculum_steps.document_id is
  'Optional material for this step. ON DELETE SET NULL rather than CASCADE: removing a document must not remove the step that referenced it.';

-- ── How far each candidate has got ──

create table if not exists public.curriculum_progress (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,
  step_id uuid references public.curriculum_steps(id) on delete cascade not null,

  completed_on date not null default current_date,
  -- Who signed it off. Not a foreign key, for the same reason as
  -- audit_log.actor_id: the record must outlive the mentor, and lodges
  -- change officers every year.
  signed_off_by uuid,
  signed_off_by_name text,
  notes text,

  -- A step is done or it is not. The row's existence IS the completion,
  -- which is why there is no boolean here to fall out of step with it.
  unique (member_id, step_id)
);

comment on table public.curriculum_progress is
  'One row per completed step per candidate. The row''s EXISTENCE is the completion — there is deliberately no boolean column that could disagree with it. Deleting the row un-completes the step.';

alter table public.curriculum_steps enable row level security;
alter table public.curriculum_progress enable row level security;

drop policy if exists "Curriculum visible to lodge members" on public.curriculum_steps;
create policy "Curriculum visible to lodge members" on public.curriculum_steps for select
  using (tenant_id in (select public.get_user_tenant_ids()));

drop policy if exists "Curriculum managed by officers" on public.curriculum_steps;
create policy "Curriculum managed by officers" on public.curriculum_steps for all
  using (public.is_tenant_admin(tenant_id));

-- A brother sees his OWN progress; officers see everyone's. A candidate
-- being able to read another candidate's sign-offs serves nobody and
-- turns a mentor's private note into gossip.
drop policy if exists "Own curriculum progress visible" on public.curriculum_progress;
create policy "Own curriculum progress visible" on public.curriculum_progress for select
  using (member_id = auth.uid());

drop policy if exists "Curriculum progress visible to officers" on public.curriculum_progress;
create policy "Curriculum progress visible to officers" on public.curriculum_progress for select
  using (public.is_tenant_admin(tenant_id));

-- Signing off is the mentor's act, never the candidate's own.
drop policy if exists "Curriculum progress managed by officers" on public.curriculum_progress;
create policy "Curriculum progress managed by officers" on public.curriculum_progress for all
  using (public.is_tenant_admin(tenant_id));

create index if not exists idx_curriculum_steps_degree
  on public.curriculum_steps (tenant_id, degree, sort_order);

create index if not exists idx_curriculum_progress_member
  on public.curriculum_progress (tenant_id, member_id);
