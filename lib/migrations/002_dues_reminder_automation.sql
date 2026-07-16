-- ============================================================
-- MIGRATION: dues reminder automation
-- Run against an already-provisioned database (one that has already
-- run schema.sql). If provisioning a brand new database instead, add
-- this column directly to schema.sql's tenant_members table and skip
-- this file.
-- ============================================================

alter table public.tenant_members
  add column if not exists last_dues_reminder text;

comment on column public.tenant_members.last_dues_reminder is
  'Last dues-reminder threshold sent to this member (e.g. T-30, T-15, T-7, overdue-2026-07). Prevents duplicate sends from the automated reminder cron. Cleared to null when dues_status flips to paid.';
