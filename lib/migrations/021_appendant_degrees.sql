-- ============================================================
-- 021: Appendant body degrees
-- ============================================================
--
-- A brother could only be recorded as EA, FC or MM. Every lodge has
-- brethren who are also Royal Arch Masons, Knights Templar, 32°, or
-- Nobles of the Shrine, and there was nowhere to put that.
--
-- The full list, its labels and its ordering live in lib/degrees.ts —
-- that file is the source of truth and explains what the ordering does
-- and does not mean. This migration only widens the two constraints
-- that would otherwise reject the new values.
--
-- WHY BOTH COLUMNS. documents.access_level is drawn from the same
-- vocabulary as tenant_members.degree (plus 'all'), because access is
-- a floor compared against the brother's degree. Widening one without
-- the other would let a Secretary set a brother to 32° and then find
-- he cannot mark a document 32°.
--
-- DELIBERATELY NOT TOUCHED: degree_progress.degree stays EA/FC/MM.
-- That table tracks conferral and proficiency through the Blue Lodge —
-- the candidate's progression the lodge itself confers. It is not a
-- record of appendant membership, and widening it would invite writing
-- Shrine rows into a table whose whole purpose is Blue Lodge work.
--
-- No data migration is needed: every existing value (EA/FC/MM, and
-- 'all' for documents) remains valid under the wider constraint.
--
-- SAFE TO RE-RUN.

-- ── Roster degrees ──

alter table public.tenant_members
  drop constraint if exists tenant_members_degree_check;

alter table public.tenant_members
  add constraint tenant_members_degree_check check (degree in (
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

comment on column public.tenant_members.degree is
  'The brother''s highest degree, Blue Lodge or appendant body. Values and their ordering are defined in lib/degrees.ts; ordering beyond MM is nominal (the rites are parallel bodies, not one ladder) but every appendant degree correctly ranks above MM since all require it. Drives document access as a floor.';

-- ── Document access floors ──

alter table public.documents
  drop constraint if exists documents_access_level_check;

alter table public.documents
  add constraint documents_access_level_check check (access_level in (
    'all',
    'EA','FC','MM',
    'MARK_MASTER','PAST_MASTER','MOST_EXCELLENT_MASTER','ROYAL_ARCH',
    'ROYAL_MASTER','SELECT_MASTER','SUPER_EXCELLENT_MASTER','KNIGHT_TEMPLAR',
    'SR_14','SR_18','SR_30','SR_32','SR_33',
    'NOBLE'
  ));

comment on column public.documents.access_level is
  'Minimum degree required to see and download this document, or ''all''. A FLOOR, not an exact match — a Master Mason can read anything an EA can. Enforced in the app (see /api/documents/[id]/download), not in storage RLS, which cannot evaluate it.';
