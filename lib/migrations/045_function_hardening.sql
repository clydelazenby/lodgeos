-- 045 · Pin the search_path on every function, and stop exposing the
--       trigger functions as callable API endpoints
--
-- Both raised by Supabase's own security linter. Neither is an open
-- door today; both are the sort of thing that becomes one later.
--
-- ── search_path ─────────────────────────────────────────────────────
--
-- A SECURITY DEFINER function runs as its owner. Without a pinned
-- search_path it resolves unqualified names using the CALLER's, so
-- anyone who can create an object in a schema earlier in that path can
-- have the function call their table or their operator instead of ours
-- — while running with the owner's rights.
--
-- Five of these nine ARE the security boundary: is_tenant_admin,
-- is_super_admin, get_user_tenant_ids, can_set_permissions and
-- can_edit_duties are what every RLS policy in this database calls to
-- decide who may read a lodge's roster. They are the last functions in
-- the system that should resolve a name ambiguously.
--
-- pg_temp is listed LAST and deliberately: it is where a caller can
-- create objects, so anywhere but last is the vulnerability itself.
--
-- ── the trigger functions ───────────────────────────────────────────
--
-- handle_new_user, handle_updated_at, update_tenant_member_count and
-- refresh_communication_counts all return `trigger` and are attached to
-- tables. PostgREST still exposes them at /rest/v1/rpc/<name>, callable
-- by anon. There is nothing useful an attacker gets from calling one —
-- a trigger function invoked outside a trigger has no NEW row and
-- errors — but they are not part of this app's API and should not be
-- reachable from the internet.
--
-- Revoking EXECUTE does NOT affect the triggers. A trigger fires as the
-- table owner and does not consult the calling role's grants.
--
-- WHAT IS DELIBERATELY NOT REVOKED. The five helpers keep EXECUTE for
-- anon and authenticated, and must. Every RLS policy in this schema is
-- granted to role `public` and calls them as the querying role — the
-- policy "Public events visible to all" on lodge_events calls both
-- get_user_tenant_ids() and is_super_admin() for an ANONYMOUS visitor
-- reading a lodge's public calendar. Revoking there would take the
-- public website down, which is a considerably worse outcome than the
-- warning it silences. Called by anon they return false and an empty
-- set, which is no disclosure at all.
--
-- Re-runnable: alter/revoke are idempotent.

alter function public.is_tenant_admin(uuid)            set search_path = public, pg_temp;
alter function public.is_super_admin()                 set search_path = public, pg_temp;
alter function public.get_user_tenant_ids()            set search_path = public, pg_temp;
alter function public.can_set_permissions(uuid)        set search_path = public, pg_temp;
alter function public.can_edit_duties(uuid)            set search_path = public, pg_temp;
alter function public.handle_new_user()                set search_path = public, pg_temp;
alter function public.handle_updated_at()              set search_path = public, pg_temp;
alter function public.update_tenant_member_count()     set search_path = public, pg_temp;
alter function public.refresh_communication_counts()   set search_path = public, pg_temp;

revoke execute on function public.handle_new_user()              from anon, authenticated;
revoke execute on function public.handle_updated_at()            from anon, authenticated;
revoke execute on function public.update_tenant_member_count()   from anon, authenticated;
revoke execute on function public.refresh_communication_counts() from anon, authenticated;

comment on function public.is_tenant_admin(uuid) is
  'Is the current user an officer of this lodge? Called by nearly every RLS policy in the schema, so it keeps EXECUTE for anon — policies run as the querying role, and the public events policy calls it for anonymous visitors. search_path pinned (migration 045).';
