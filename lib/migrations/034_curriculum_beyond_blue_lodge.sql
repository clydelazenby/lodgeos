-- ============================================================
-- 034: Curricula past the Master Mason degree, and sign-off
-- ============================================================
--
-- PART ONE — EVERY DEGREE, NOT THREE.
--
-- 031 constrained curriculum_steps.degree to EA/FC/MM, and the comment
-- I wrote there argued that appendant bodies are separate organisations
-- with their own work. That reasoning holds for who CONFERS a degree —
-- a Blue Lodge does not confer the 32° — and it turns out to be the
-- wrong reason to refuse the column.
--
-- A lodge mentors its brethren past the third degree whether or not it
-- confers what comes next: someone tells a new Master Mason what the
-- York Rite is, someone walks him toward the Scottish Rite, someone
-- notices he has been a Noble for a year and never been asked to do
-- anything. That mentoring is lodge work even when the degree is not.
-- The lodge asked for it, and it is their record to keep.
--
-- Widened to the same seventeen values as tenant_members.degree, from
-- the single list in lib/degrees.ts, so a brother recorded at 32° can
-- have a 32° curriculum rather than falling off the end of the tracker.
--
-- NO STARTER OUTLINE beyond the Blue Lodge, deliberately. The app ships
-- a conventional EA/FC/MM outline because those stages are near
-- universal and it is offered as something to edit. It has no business
-- inventing what the Scottish Rite requires; those steps are written by
-- the lodge or not at all.
--
-- PART TWO — SUBMIT, THEN SIGN OFF OR DECLINE.
--
-- Until now a brother ticked a task and it was done, and a curriculum
-- step was signed off by an officer with the candidate having no way to
-- say he was ready. Neither told anybody anything.
--
-- Now: the brother SUBMITS, the officer who gave him the work is
-- emailed, and that officer signs it off or declines it with a reason.
-- Declining sends it back rather than deleting it, so the brother sees
-- both that it was refused and why — a proficiency returned without a
-- reason teaches nothing.
--
-- WHERE COMPLETION LIVES DOES NOT CHANGE. A plain task completes on the
-- assignment row; a curriculum step completes in curriculum_progress,
-- where an officer's sign-off has always lived. Submitting is a
-- separate fact from completing and gets its own column, so the two can
-- never be confused.
--
-- SAFE TO RE-RUN.

-- ── Every degree ──

alter table public.curriculum_steps
  drop constraint if exists curriculum_steps_degree_check;

alter table public.curriculum_steps
  add constraint curriculum_steps_degree_check check (degree in (
    -- Blue Lodge
    'EA','FC','MM',
    -- York Rite
    'MARK_MASTER','PAST_MASTER','MOST_EXCELLENT_MASTER','ROYAL_ARCH',
    'ROYAL_MASTER','SELECT_MASTER','SUPER_EXCELLENT_MASTER','KNIGHT_TEMPLAR',
    -- Scottish Rite
    'SR_14','SR_18','SR_30','SR_32','SR_33',
    -- Shrine
    'NOBLE'
  ));

comment on column public.curriculum_steps.degree is
  'Which degree''s work this step belongs to. The same seventeen values as tenant_members.degree — see lib/degrees.ts. A lodge does not confer the appendant degrees, but it does mentor its brethren toward them, and that mentoring is lodge work. Only EA/FC/MM have a starter outline; the rest are written by the lodge or not at all.';

-- ── Submitted, declined ──

alter table public.assignments
  add column if not exists submitted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists declined_by_name text,
  add column if not exists decline_note text;

comment on column public.assignments.submitted_at is
  'When the brother said he had done it. A separate fact from completing: submitting is his claim, completion is the officer''s acceptance of it. Cleared when an officer declines, so a resubmission is a fresh claim.';

comment on column public.assignments.declined_at is
  'Set when an officer sent it back. The row is NOT deleted and completed_at is NOT set — the brother needs to see that it was refused and, in decline_note, why. A proficiency returned without a reason teaches nothing.';

-- The officer's queue is "submitted, not yet decided", which is the
-- one view this feature exists to serve.
create index if not exists idx_assignments_awaiting
  on public.assignments (tenant_id, submitted_at)
  where submitted_at is not null and completed_at is null and cancelled_at is null;
