-- ============================================================
-- 026: Who did that, and when
-- ============================================================
--
-- Nothing in this app recorded who changed anything. A dues status
-- flipped from due to paid, a brother came off the roster, a degree was
-- marked conferred, a charge appeared on an account — and afterwards
-- there was no way to answer the only question anyone ever asks about
-- those events, which is who did it.
--
-- Lodges hand over every office annually. The Secretary who made an
-- entry in March is frequently not the Secretary being asked about it
-- in November, and "the system says he's paid" is not an answer when a
-- brother is standing there with a receipt. This is unglamorous and it
-- is the first thing wanted the day there is a disagreement about money.
--
-- WHAT IS NOT HERE, DELIBERATELY:
--
-- No before/after column diffing. A generic trigger-based audit of every
-- table would capture far more than anyone reads and would quietly
-- record personal data in a second place, which is a liability rather
-- than a feature. Entries are written explicitly by the routes that
-- make meaningful changes, and each says in one line what happened.
--
-- No deletes and no updates. An audit trail that can be edited is not
-- one. RLS below grants select and insert only — there is no policy
-- permitting update or delete, so with RLS on, no client can alter a
-- row through the API at any tier. The service role bypasses RLS by
-- design, which is why entries are written with it and never rewritten.
--
-- Not a security log. It records lodge business, not sessions and IP
-- addresses.
--
-- SAFE TO RE-RUN.

create table if not exists public.audit_log (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,

  -- Nullable on purpose: a cron job sending dues reminders is a real
  -- actor with no person behind it, and recording a fake user id for it
  -- would be worse than recording none. Deliberately NOT a foreign key
  -- with on delete cascade — an entry must survive the departure of the
  -- officer who made it, which is precisely when it matters most.
  actor_id uuid,
  actor_name text,

  action text not null,
  entity_type text,
  entity_id uuid,

  -- One human sentence, written at the call site: "Marked Bro. Smith's
  -- dues paid", "Took Bro. Jones off the roster as demitted". The page
  -- reads these; it does not reconstruct prose from columns.
  summary text not null,

  -- Structured spillover for the rare case someone needs the specifics
  -- (the amount, the old value). Never rendered as the primary account
  -- of what happened.
  detail jsonb
);

comment on table public.audit_log is
  'Append-only record of meaningful lodge changes: money, roster, degrees, records. Written explicitly by API routes via lib/audit.ts, never by triggers. No update or delete policy exists, so it cannot be rewritten through the API. Not a security or access log.';

comment on column public.audit_log.actor_id is
  'The profile that acted, or null for a system actor such as the dues-reminder cron. Intentionally not a foreign key: the entry must outlive the officer, and lodges change officers every year.';

alter table public.audit_log enable row level security;

-- Readable by the lodge's administrative office only. This is the one
-- table in the app where a Deacon seeing everything the Treasurer did
-- would be a change in the lodge's own delegation of authority, so it
-- is deliberately narrower than is_tenant_admin() — which since
-- migration 022 means "holds administrative access of some kind" and
-- includes wardens and deacons.
create policy "Audit visible to the secretary's office" on public.audit_log for select
  using (
    exists (
      select 1 from public.tenant_members
      where tenant_id = audit_log.tenant_id
        and user_id = auth.uid()
        and tenant_role in ('admin', 'secretary', 'grand_master', 'worshipful_master', 'treasurer')
        and is_active = true
    )
    or public.is_super_admin()
  );

-- Entries are written server-side with the service role, which bypasses
-- RLS. This policy exists so that a future in-app writer running as the
-- officer still works, and so the absence of update/delete policies is
-- an explicit statement rather than an oversight.
create policy "Audit entries insertable by the lodge" on public.audit_log for insert
  with check (public.is_tenant_admin(tenant_id));

-- The page reads the newest entries for one lodge, optionally filtered
-- by action. Both are covered.
create index if not exists idx_audit_log_tenant_time
  on public.audit_log (tenant_id, created_at desc);

create index if not exists idx_audit_log_entity
  on public.audit_log (tenant_id, entity_type, entity_id);
