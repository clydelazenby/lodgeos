-- ============================================================
-- 025: Why a brother left the rolls
-- ============================================================
--
-- tenant_members recorded membership as a single boolean, is_active.
-- A brother was on the roster or he was not, and the reason he stopped
-- being on it was recorded nowhere at all.
--
-- That is not an abstract tidiness problem. Every Grand Lodge annual
-- return asks for the breakdown — demitted, suspended, expelled, died —
-- and lib/reports/AnnualReturnDocument.tsx has been carrying a printed
-- apology to that effect: "this system currently records only whether a
-- member is active or inactive... it must currently be determined
-- manually by cross-referencing lodge records." Once a year somebody
-- reconstructs from memory what the database watched happen.
--
-- The four statuses are not interchangeable, either. A demit is a
-- brother in good standing leaving of his own accord and he may be
-- received back tomorrow. A suspension for non-payment is reversible on
-- payment. An expulsion is a Grand Lodge matter. A death is permanent,
-- and it changes who the lodge writes to — his widow, not him.
--
-- WHY REMOVAL BECOMES A STATUS CHANGE. /api/members/remove deleted the
-- tenant_members row outright. The comment above it argued, correctly,
-- that attendance and payments must survive removal — and they did,
-- because they key off profiles.id. But the membership itself did not,
-- so the lodge lost the one fact the annual return actually asks for:
-- that this man was a member, and on this date he ceased to be, for
-- this reason. The row now stays and its status changes.
--
-- 'removed' exists for the case with no Masonic meaning at all: a
-- duplicate row, a typo, a test entry. It is deliberately not a
-- synonym for any of the others, so it can be excluded from a return.
--
-- BACKFILL. Everything currently active becomes 'active'. Anything
-- already inactive becomes 'inactive_unspecified' rather than a guess —
-- the reason genuinely is not in the database, and inventing one would
-- put a fabricated number on a Grand Lodge return, which is the exact
-- failure this migration exists to prevent.
--
-- SAFE TO RE-RUN.

alter table public.tenant_members
  add column if not exists membership_status text,
  add column if not exists status_date date,
  add column if not exists status_note text;

-- Backfill before the constraint, or the constraint rejects the nulls.
update public.tenant_members
  set membership_status = case when is_active then 'active' else 'inactive_unspecified' end
  where membership_status is null;

alter table public.tenant_members
  alter column membership_status set default 'active';

alter table public.tenant_members
  alter column membership_status set not null;

alter table public.tenant_members
  drop constraint if exists tenant_members_membership_status_check;

alter table public.tenant_members
  add constraint tenant_members_membership_status_check
  check (membership_status in (
    'active',
    'demitted',
    'suspended',
    'expelled',
    'deceased',
    'removed',
    'inactive_unspecified'
  ));

comment on column public.tenant_members.membership_status is
  'Why this brother is or is not on the rolls. Values and labels live in lib/membership.ts. ''active'' is the only status that keeps him on the roster; is_active is kept in step with it by the app (see /api/members/remove) and remains what RLS and every existing query key off, so this column adds a reason without changing any access rule. ''inactive_unspecified'' is the honest backfill for rows that went inactive before this column existed — it means the reason is not known, not that there was none.';

comment on column public.tenant_members.status_date is
  'The date the current status took effect — the date of the demit, the suspension, the death. Not created_at and not now(): a Secretary recording a death three weeks later needs the date it happened, because that is the date the annual return asks for.';

comment on column public.tenant_members.status_note is
  'Free text the Secretary may add, e.g. "Demitted to Corinthian #45" or "Suspended NPD, 2026 dues". Never sent to the brother; the removal email carries its own separately-entered note.';

-- The roster query filters on is_active and the annual return groups by
-- status within a date window. Both are covered here.
create index if not exists idx_tenant_members_status
  on public.tenant_members (tenant_id, membership_status, status_date);
