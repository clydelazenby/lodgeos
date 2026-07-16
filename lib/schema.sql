-- ============================================================
-- LODGEOS — MULTI-TENANT DATABASE SCHEMA
-- Paste this entire file into Supabase SQL Editor and run it
-- ============================================================

-- ============================================================
-- TENANTS (Lodges)
-- ============================================================
create table public.tenants (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Identity
  name text not null,                          -- "Psalms of Job Lodge"
  number text not null,                        -- "1827"
  slug text unique not null,                   -- "psalms-of-job-1827" (URL key)
  -- Location
  address text,
  city text,
  state text,
  zip text,
  -- Contact
  email text,
  phone text,
  website text,
  -- Branding
  primary_color text default '#C9A84C',        -- Gold
  secondary_color text default '#0A0E1A',      -- Navy
  logo_url text,
  -- Subscription
  plan text check (plan in ('trial','starter','pro','district')) default 'trial',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text check (subscription_status in ('active','past_due','canceled','trialing','incomplete')) default 'trialing',
  trial_ends_at timestamptz default (now() + interval '14 days'),
  billing_cycle text check (billing_cycle in ('monthly','annual')) default 'monthly',
  -- Settings
  dues_amount numeric(10,2) default 60.00,
  dues_due_month int default 1,                -- January
  timezone text default 'America/New_York',
  is_active boolean default true,
  -- Rite / affiliation
  rite text default 'F&AM',
  jurisdiction text,
  -- Content (editable by lodge admin)
  about_text text,
  history_text text,
  meeting_schedule text,
  -- Meta
  member_count int default 0,
  onboarding_complete boolean default false
);

-- ============================================================
-- PROFILES (Users — both lodge admins and brothers)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  -- Identity
  first_name text,
  last_name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  avatar_url text,
  -- Platform role
  platform_role text check (platform_role in ('super_admin','user')) default 'user',
  -- Onboarding
  onboarding_complete boolean default false
);

-- ============================================================
-- TENANT MEMBERS (Links users to lodges with roles)
-- ============================================================
create table public.tenant_members (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  -- Lodge-specific info
  degree text check (degree in ('EA','FC','MM')) default 'EA',
  lodge_role text,                             -- "Worshipful Master", "Secretary" etc
  dues_status text check (dues_status in ('paid','due','exempt')) default 'due',
  dues_paid_at timestamptz,
  dues_year int default extract(year from now()),
  is_active boolean default true,
  joined_date date,
  notes text,
  -- Permissions within this lodge
  tenant_role text check (tenant_role in ('admin','secretary','member')) default 'member',
  unique(tenant_id, user_id)
);

-- ============================================================
-- LODGE EVENTS
-- ============================================================
create table public.lodge_events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  title text not null,
  event_date date not null,
  event_time time,
  location text,
  description text,
  dress_code text,
  is_public boolean default false,
  event_type text check (event_type in ('degree','stated_communication','grand_lodge','social','other')) default 'other',
  created_by uuid references public.profiles(id)
);

-- ============================================================
-- PETITIONS
-- ============================================================
create table public.petitions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text not null,
  age int check (age >= 18),
  occupation text,
  believes_in_supreme_being boolean,
  reason text,
  referred_by text,
  status text check (status in ('new','under_review','approved','denied')) default 'new',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  notes text
);

-- ============================================================
-- COMMUNICATIONS
-- ============================================================
create table public.communications (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  subject text not null,
  body text not null,
  sent_by uuid references public.profiles(id),
  recipient_group text check (recipient_group in ('all','mm_only','candidates','dues_outstanding')) default 'all',
  is_draft boolean default false,
  sent_at timestamptz
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  name text not null,
  category text not null,
  file_url text not null,
  file_size int,
  access_level text check (access_level in ('all','EA','FC','MM')) default 'all',
  uploaded_by uuid references public.profiles(id),
  description text
);

-- ============================================================
-- DEGREE PROGRESS
-- ============================================================
create table public.degree_progress (
  id uuid default gen_random_uuid() primary key,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,
  degree text check (degree in ('EA','FC','MM')) not null,
  conferred_date date,
  proficiency_passed boolean default false,
  proficiency_date date,
  notes text,
  unique(tenant_id, member_id, degree)
);

-- ============================================================
-- PAYMENTS (Dues payment records)
-- ============================================================
create table public.payments (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10,2) not null,
  currency text default 'usd',
  stripe_payment_intent_id text unique,
  stripe_session_id text unique,
  status text check (status in ('pending','succeeded','failed','refunded')) default 'pending',
  dues_year int,
  description text,
  receipt_url text
);

-- ============================================================
-- PLATFORM SUBSCRIPTIONS (LodgeOS billing)
-- ============================================================
create table public.platform_subscriptions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade unique not null,
  stripe_subscription_id text unique,
  stripe_customer_id text unique,
  plan text check (plan in ('starter','pro','district')) not null,
  billing_cycle text check (billing_cycle in ('monthly','annual')) default 'monthly',
  status text check (status in ('active','past_due','canceled','trialing','incomplete')) default 'trialing',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  amount numeric(10,2),
  trial_end timestamptz
);

-- ============================================================
-- ATTENDANCE
-- ============================================================
create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  event_id uuid references public.lodge_events(id) on delete cascade not null,
  member_id uuid references public.profiles(id) on delete cascade not null,
  status text check (status in ('present','absent','excused')) default 'present',
  unique(event_id, member_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_members enable row level security;
alter table public.lodge_events enable row level security;
alter table public.petitions enable row level security;
alter table public.communications enable row level security;
alter table public.documents enable row level security;
alter table public.degree_progress enable row level security;
alter table public.payments enable row level security;
alter table public.platform_subscriptions enable row level security;
alter table public.attendance enable row level security;

-- Helper function: get current user's tenant memberships
create or replace function public.get_user_tenant_ids()
returns setof uuid language sql security definer as $$
  select tenant_id from public.tenant_members where user_id = auth.uid() and is_active = true;
$$;

-- Helper function: check if user is tenant admin/secretary
create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id
    and user_id = auth.uid()
    and tenant_role in ('admin','secretary')
    and is_active = true
  );
$$;

-- Helper function: check if super admin
create or replace function public.is_super_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
    and platform_role = 'super_admin'
  );
$$;

-- TENANTS
create policy "Tenants visible to members" on public.tenants for select
  using (id in (select public.get_user_tenant_ids()) or public.is_super_admin());
create policy "Tenants updatable by admins" on public.tenants for update
  using (public.is_tenant_admin(id) or public.is_super_admin());
create policy "Tenants insertable during signup" on public.tenants for insert
  with check (true);

-- PROFILES
create policy "Users can view own profile" on public.profiles for select
  using (id = auth.uid() or public.is_super_admin());
create policy "Users can update own profile" on public.profiles for update
  using (id = auth.uid());
create policy "Profile created on signup" on public.profiles for insert
  with check (id = auth.uid());
create policy "Tenant members visible to lodge members" on public.profiles for select
  using (id in (
    select user_id from public.tenant_members
    where tenant_id in (select public.get_user_tenant_ids())
  ));

-- TENANT MEMBERS
create policy "Members visible to lodge members" on public.tenant_members for select
  using (tenant_id in (select public.get_user_tenant_ids()) or public.is_super_admin());
create policy "Members manageable by admins" on public.tenant_members for all
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());
create policy "Own membership always visible" on public.tenant_members for select
  using (user_id = auth.uid());

-- EVENTS
create policy "Public events visible to all" on public.lodge_events for select
  using (is_public = true or tenant_id in (select public.get_user_tenant_ids()) or public.is_super_admin());
create policy "Events manageable by admins" on public.lodge_events for all
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- PETITIONS (anyone can submit, only admins view/update)
create policy "Anyone can submit petition" on public.petitions for insert with check (true);
create policy "Petitions viewable by admins" on public.petitions for select
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());
create policy "Petitions updatable by admins" on public.petitions for update
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- COMMUNICATIONS
create policy "Comms visible to lodge members" on public.communications for select
  using (tenant_id in (select public.get_user_tenant_ids()) or public.is_super_admin());
create policy "Comms manageable by admins" on public.communications for all
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- DOCUMENTS
create policy "Documents visible to lodge members" on public.documents for select
  using (tenant_id in (select public.get_user_tenant_ids()) or public.is_super_admin());
create policy "Documents manageable by admins" on public.documents for all
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- DEGREE PROGRESS
create policy "Degree progress visible to lodge" on public.degree_progress for select
  using (tenant_id in (select public.get_user_tenant_ids()) or public.is_super_admin());
create policy "Own degree progress always visible" on public.degree_progress for select
  using (member_id = auth.uid());
create policy "Degree progress manageable by admins" on public.degree_progress for all
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- PAYMENTS
create policy "Own payments visible" on public.payments for select
  using (member_id = auth.uid() or public.is_tenant_admin(tenant_id) or public.is_super_admin());
create policy "Payments insertable" on public.payments for insert with check (true);
create policy "Payments updatable by admins" on public.payments for update
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- PLATFORM SUBSCRIPTIONS
create policy "Subscriptions visible to admins" on public.platform_subscriptions for select
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());
create policy "Subscriptions manageable by super admin" on public.platform_subscriptions for all
  using (public.is_super_admin());

-- ATTENDANCE
create policy "Attendance visible to lodge" on public.attendance for select
  using (tenant_id in (select public.get_user_tenant_ids()) or public.is_super_admin());
create policy "Attendance manageable by admins" on public.attendance for all
  using (public.is_tenant_admin(tenant_id) or public.is_super_admin());

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update tenant member count
create or replace function public.update_tenant_member_count()
returns trigger language plpgsql as $$
begin
  update public.tenants
  set member_count = (
    select count(*) from public.tenant_members
    where tenant_id = coalesce(new.tenant_id, old.tenant_id)
    and is_active = true
  )
  where id = coalesce(new.tenant_id, old.tenant_id);
  return coalesce(new, old);
end;
$$;

create trigger update_member_count
  after insert or update or delete on public.tenant_members
  for each row execute procedure public.update_tenant_member_count();

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger handle_updated_at_tenants
  before update on public.tenants
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at_profiles
  before update on public.profiles
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- SEED: Super admin + Psalms of Job Lodge
-- ============================================================

-- NOTE: After running this schema:
-- 1. Create your account in Supabase Auth (Authentication → Users → Invite)
-- 2. Run this to make yourself super admin (replace with your actual user ID):
--    UPDATE public.profiles SET platform_role = 'super_admin' WHERE email = 'clydelazenby@gmail.com';
-- 3. Then create your lodge through the onboarding flow

-- Seed the Psalms of Job lodge (will be linked to your user after signup)
insert into public.tenants (
  name, number, slug, address, city, state, zip,
  email, primary_color, secondary_color,
  plan, subscription_status, rite, jurisdiction,
  about_text, meeting_schedule, onboarding_complete
) values (
  'Psalms of Job Lodge', '1827', 'psalms-of-job-1827',
  '1110 Massey St', 'Smithfield', 'NC', '27577',
  'psalmslodge1827@gmail.com', '#C9A84C', '#0A0E1A',
  'pro', 'active', 'F&AM', 'North Carolina',
  'Psalms of Job Lodge #1827 meets in Smithfield, North Carolina. We are a brotherhood of men from across Johnston County and the greater Triangle region.',
  'Stated communications held monthly. Contact the Secretary for current schedule.',
  true
);
