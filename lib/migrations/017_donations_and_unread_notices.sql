-- ============================================================
-- 017: Public donations, and unread notice counts
-- ============================================================
--
-- Two unrelated additions, together because both are single-column
-- changes to existing tables.
--
-- SAFE TO RE-RUN.

-- ── PART 1: DONATIONS ──
--
-- The public lodge page had no way to accept a gift. Lodges take
-- donations through the same peer-to-peer apps their members already
-- use, so these hold the lodge's own handles. LodgeOS does not process
-- the money — it presents the lodge's details and, where the app
-- supports it, builds a prefilled deep link.
--
-- Deliberately NOT storing bank account or routing numbers. Zelle is
-- addressed by the email or mobile number registered with the bank
-- (Truist, in this lodge's case), which is all a donor needs and is not
-- itself sensitive the way an account number is. Anything that could
-- drain an account has no business in an application database, let
-- alone one rendered onto a public page.

alter table public.tenants
  add column if not exists donations_enabled boolean default false;

-- Cash App $cashtag, stored WITHOUT the leading $ — the UI adds it.
alter table public.tenants
  add column if not exists cashapp_handle text;

-- Venmo username, stored without the leading @.
alter table public.tenants
  add column if not exists venmo_handle text;

-- The email address or mobile number enrolled with the lodge's bank.
alter table public.tenants
  add column if not exists zelle_handle text;

-- The name a donor should expect to see confirmed in their banking app
-- before sending. Without it a donor has no way to tell a correct Zelle
-- recipient from a mistyped one, and Zelle transfers are irreversible.
alter table public.tenants
  add column if not exists zelle_name text;

-- Optional appeal shown above the payment options.
alter table public.tenants
  add column if not exists donation_message text;

comment on column public.tenants.zelle_name is
  'Account name a donor should see confirmed in their banking app before sending. Zelle transfers cannot be reversed, so showing the expected name is the only check a donor gets.';

comment on column public.tenants.donations_enabled is
  'Whether the public lodge page shows a Donate button. Off by default — a lodge with no handles configured must not advertise a donation page that cannot take anything.';

-- ── PART 2: UNREAD NOTICES ──
--
-- `communications` recorded what was sent but nothing about who had
-- read it, so the app could not tell a brother he had something
-- waiting. A single timestamp per membership is enough: anything sent
-- after it is unread. That is far cheaper than a row per member per
-- notice, and for a "you have 3 waiting" badge it is exactly as
-- accurate.
--
-- Per MEMBERSHIP rather than per profile, because a brother belonging
-- to two lodges reads their notices independently.

alter table public.tenant_members
  add column if not exists communications_last_read_at timestamptz;

comment on column public.tenant_members.communications_last_read_at is
  'When this brother last opened the Communications page. Notices sent after it count as unread. Null means he has never opened it, so every notice counts.';

-- The badge query counts non-draft notices for a tenant newer than a
-- timestamp, on every page load of every lodge route.
create index if not exists idx_communications_tenant_sent
  on public.communications (tenant_id, sent_at desc)
  where is_draft = false;

analyze public.tenants;
analyze public.tenant_members;
analyze public.communications;
