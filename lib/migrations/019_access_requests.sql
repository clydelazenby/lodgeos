-- ============================================================
-- 019: Access requests — platform and portal
-- ============================================================
--
-- Two tables, both answering the same shape of question: "someone
-- wants in, who do we tell?" They are separate because the two asks go
-- to different people and mean different things.
--
--   platform_access_requests — a LODGE asking to use LodgeOS. Replaces
--     self-serve signup on /start. Not tenant-scoped: the tenant does
--     not exist yet, that is the entire point of the request.
--
--   portal_access_requests — an existing BROTHER of a lodge asking his
--     Secretary for a portal login. Tenant-scoped, and it feeds the
--     invite form on the Members page.
--
-- Both are written by anonymous visitors, so both take the petitions
-- table's posture: anyone may INSERT, nobody may read back except the
-- people who act on them. A request is not a login and grants nothing;
-- approving one is a human deciding to invite somebody.
--
-- SAFE TO RE-RUN.

-- ── PART 1: LODGES REQUESTING LODGEOS ──

create table if not exists public.platform_access_requests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),

  lodge_name text not null,
  lodge_number text,
  -- Grand Lodge / state. Free text on purpose: jurisdictions are not a
  -- clean enumerable list and a wrong dropdown loses the request.
  jurisdiction text,

  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  -- The office held by whoever is asking (Secretary, Master, ...).
  contact_role text,

  -- Rough roster size. Kept nullable and unvalidated beyond a floor —
  -- a prospect estimating "about 40" should never be blocked on it.
  member_count int check (member_count is null or member_count >= 0),

  message text,

  status text check (status in ('new','contacted','approved','declined')) default 'new',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  notes text
);

create index if not exists platform_access_requests_status_idx
  on public.platform_access_requests (status, created_at desc);

-- Duplicate suppression in the API reads by email; this keeps that
-- lookup cheap as the table grows.
create index if not exists platform_access_requests_email_idx
  on public.platform_access_requests (lower(contact_email), created_at desc);

alter table public.platform_access_requests enable row level security;

drop policy if exists "Anyone can request platform access" on public.platform_access_requests;
create policy "Anyone can request platform access"
  on public.platform_access_requests for insert with check (true);

-- Only the platform owner. There is no tenant to scope these to, so
-- there is no tenant admin who could reasonably read them.
drop policy if exists "Platform requests viewable by super admin" on public.platform_access_requests;
create policy "Platform requests viewable by super admin"
  on public.platform_access_requests for select using (public.is_super_admin());

drop policy if exists "Platform requests updatable by super admin" on public.platform_access_requests;
create policy "Platform requests updatable by super admin"
  on public.platform_access_requests for update using (public.is_super_admin());

-- ── PART 2: BROTHERS REQUESTING A PORTAL LOGIN ──

create table if not exists public.portal_access_requests (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,

  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,

  -- What he says about himself. NONE of this is verified, and none of
  -- it may be trusted as a claim of membership or of office — the
  -- Secretary is the one who knows whether this is a brother of the
  -- lodge, and inviting him is a deliberate act on the Members page.
  years_a_member text,
  lodge_role text,
  message text,

  -- 'invited' is set when a Secretary acts on the request from the
  -- Members page; 'dismissed' when he decides not to.
  status text check (status in ('new','invited','dismissed')) default 'new',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);

-- The Members page reads pending requests for one lodge on every load,
-- so this wants to stay an index hit.
create index if not exists portal_access_requests_tenant_status_idx
  on public.portal_access_requests (tenant_id, status, created_at desc);

create index if not exists portal_access_requests_email_idx
  on public.portal_access_requests (tenant_id, lower(email), created_at desc);

alter table public.portal_access_requests enable row level security;

drop policy if exists "Anyone can request portal access" on public.portal_access_requests;
create policy "Anyone can request portal access"
  on public.portal_access_requests for insert with check (true);

drop policy if exists "Portal requests viewable by admins" on public.portal_access_requests;
create policy "Portal requests viewable by admins"
  on public.portal_access_requests for select
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

drop policy if exists "Portal requests updatable by admins" on public.portal_access_requests;
create policy "Portal requests updatable by admins"
  on public.portal_access_requests for update
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());
