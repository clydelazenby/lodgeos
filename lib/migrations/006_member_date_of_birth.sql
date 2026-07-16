-- ============================================================
-- MIGRATION: member date of birth
-- Run against an already-provisioned database.
--
-- No existing field tracks this. The trestleboard generator (added
-- alongside this migration) is meant to surface member birthdays each
-- month, per the original feature request — that's impossible without
-- somewhere to store the date. Added to profiles rather than
-- tenant_members since date of birth is a property of the PERSON, not
-- of their membership in a particular lodge (relevant if this ever
-- becomes multi-lodge again — one person's birthday shouldn't need to
-- be re-entered per lodge they belong to).
-- ============================================================

alter table public.profiles
  add column if not exists date_of_birth date;

comment on column public.profiles.date_of_birth is
  'Optional. Used by the trestleboard generator to surface birthdays occurring in a given month. Nullable — many existing members will not have this set until entered manually or self-reported via the brother portal.';
