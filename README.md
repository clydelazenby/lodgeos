# LodgeOS — Full Deployment Guide
## The Operating System for Your Lodge

---

## What You Built

LodgeOS is a multi-tenant SaaS platform for Masonic lodges. One codebase serves unlimited lodges, each fully isolated with their own data, branding, and members.

**Platform layers:**
- `lodgeos.com` — Marketing site + signup
- `lodgeos.com/super-admin` — Your dashboard (manage all lodges, see MRR)
- `lodgeos.com/lodge/[slug]/dashboard` — Per-lodge admin (secretary manages their lodge)
- `lodgeos.com/portal` — Brother self-service (pay dues, view events)
- `lodgeos.com/[slug]` — Public lodge website (unique per lodge)
- `lodgeos.com/[slug]/petition` — Public petition form

---

## Step 1: Supabase Setup (10 min)

1. Go to https://supabase.com → Create account → New project
2. Name it `lodgeos` → Choose a region close to NC → Set a database password
3. Wait ~2 min for project to spin up
4. Go to **SQL Editor** → paste the entire contents of `lib/schema.sql` → Run
5. Go to **Settings → API**:
   - Copy **Project URL** → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
6. Go to **Authentication → Settings**:
   - Set Site URL to `https://lodgeos.vercel.app` (or your domain)
   - Add redirect URL: `https://lodgeos.vercel.app/auth/callback`

---

## Step 2: Stripe Setup (15 min)

### Platform subscription products (you charge lodges):
1. Go to https://stripe.com → Create account
2. Go to **Products** → Create 3 products:

**Starter — $19/mo**
- Name: LodgeOS Starter
- Monthly price: $19.00 recurring → copy price ID → `STRIPE_STARTER_MONTHLY`
- Annual price: $180.00 recurring → `STRIPE_STARTER_ANNUAL`

**Pro — $39/mo**
- Name: LodgeOS Pro
- Monthly: $39.00 → `STRIPE_PRO_MONTHLY`
- Annual: $384.00 → `STRIPE_PRO_ANNUAL`

**District — $79/mo**
- Name: LodgeOS District
- Monthly: $79.00 → `STRIPE_DISTRICT_MONTHLY`
- Annual: $780.00 → `STRIPE_DISTRICT_ANNUAL`

3. Go to **Developers → API Keys**:
   - Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Secret key → `STRIPE_SECRET_KEY`

### Webhook setup:
4. Go to **Developers → Webhooks** → Add endpoint
5. URL: `https://lodgeos.vercel.app/api/webhooks/stripe`
6. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
7. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

---

## Step 3: Resend Setup (5 min)

1. Go to https://resend.com → Create account
2. Go to **API Keys** → Create key → copy it → `RESEND_API_KEY`
3. Go to **Domains** → Add your domain (or use the default resend.dev domain for testing)
4. Set `EMAIL_FROM=noreply@yourdomain.com` (or `onboarding@resend.dev` for testing)

---

## Step 3.5: Database Migrations (5 min)

`lib/schema.sql` is the base schema — run it once for a brand new
Supabase project. Everything under `lib/migrations/` alters that base
schema and must be run **in order, after** schema.sql, via Supabase →
**SQL Editor**:

1. `lib/migrations/002_dues_reminder_automation.sql` — adds the column
   the automated dues-reminder cron uses to avoid double-sending
2. `lib/migrations/003_event_rsvps.sql` — adds the `event_rsvps` table
   powering calendar invites and the attendee headcount
3. `lib/migrations/004_officer_role_tiers.sql` — expands `tenant_role`
   from a flat 3-value field into six real officer tiers, and updates
   the `is_tenant_admin()` RLS function to recognize them. **This one
   matters even for a single-lodge, single-migration-run setup** — the
   Members page's "Portal Access" dropdown and the super admin roster
   editor both assume these tiers exist in the database's check
   constraint; skipping this migration means assigning someone
   `treasurer` or `warden` will fail with a constraint violation.
4. `lib/migrations/005_care_registry.sql` — adds `care_entries` and
   `care_checkins`, the sickness/distress/widows tracker. Note its RLS
   policy is deliberately narrower than most tables here (visible to
   admin-tier roles and whoever's specifically assigned, not every
   officer by default) — see the migration file's comments before
   changing that.
5. `lib/migrations/006_member_date_of_birth.sql` — adds
   `profiles.date_of_birth`, optional, used by the trestleboard
   generator's birthday section. Existing members will show no birthday
   until this is entered manually or self-reported.

If provisioning a brand new database, it's equally valid to fold all
three migrations' changes directly into `schema.sql` and skip running
them separately — the end state is the same either way.

---

## Step 4: Deploy to Vercel (10 min)

1. Push this folder to a new GitHub repository:
```bash
cd lodgeos
git init
git add .
git commit -m "LodgeOS initial commit"
git remote add origin https://github.com/yourusername/lodgeos.git
git push -u origin main
```

2. Go to https://vercel.com → Sign in with GitHub
3. Click **New Project** → Import your `lodgeos` repo
4. Add all environment variables (copy from `.env.example`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_STARTER_MONTHLY=
STRIPE_STARTER_ANNUAL=
STRIPE_PRO_MONTHLY=
STRIPE_PRO_ANNUAL=
STRIPE_DISTRICT_MONTHLY=
STRIPE_DISTRICT_ANNUAL=
RESEND_API_KEY=
EMAIL_FROM=
NEXT_PUBLIC_APP_URL=https://lodgeos.vercel.app
SUPER_ADMIN_EMAIL=clydelazenby@gmail.com
```

5. Click **Deploy** → wait ~2 min → your site is live

---

## Step 5: Make Yourself Super Admin (5 min)

**Note:** since root `/` now renders Psalms of Job's public lodge page
directly (see "Single-Lodge Deployment" below), the old multi-tenant
signup flow lives at `/start` instead of the homepage. Use that path
for account creation.

1. Go to `https://yourdomain.com/start` → click "Start Free Trial"
2. Create your account with `clydelazenby@gmail.com`
3. Go to Supabase → **SQL Editor** → run:
```sql
UPDATE public.profiles
SET platform_role = 'super_admin'
WHERE email = 'clydelazenby@gmail.com';
```
4. Sign out and sign back in → you'll be redirected to `/super-admin`

---

## Step 6: Set Up Psalms of Job Lodge (5 min)

1. In your super admin dashboard, the seed data already created the lodge
2. Go to Supabase → **SQL Editor** → run:
```sql
-- Link your user to the Psalms of Job lodge as Secretary.
-- 'secretary' is a real permission tier as of the officer-roles
-- migration (lib/migrations/004_officer_role_tiers.sql), not just a
-- display label — this grants full lodge management access, same as
-- 'admin' does. Degree defaults to 'MM' here on the assumption you're
-- already a Master Mason; change it if that's not accurate.
INSERT INTO public.tenant_members (tenant_id, user_id, tenant_role, lodge_role, degree, is_active)
SELECT
  t.id,
  p.id,
  'secretary',
  'Secretary',
  'MM',
  true
FROM public.tenants t, public.profiles p
WHERE t.slug = 'psalms-of-job-1827'
AND p.email = 'clydelazenby@gmail.com';
```
3. Sign out and back in → you'll land at `/lodge/psalms-of-job-1827/dashboard`

**Assigning other officers:** once you're in, use the Members page
(`/lodge/psalms-of-job-1827/members`) to invite brothers directly —
the "Portal Access" dropdown there now offers all six officer tiers
(Deacon, Warden, Treasurer, Worshipful Master, Secretary, Admin), each
with real, different permissions rather than everyone sharing the same
access. See "Officer Roles & Permissions" below for what each tier can
actually do.

---

## Step 7: Add Your Brothers (ongoing)

1. Go to `/lodge/psalms-of-job-1827/members`
2. Click **+ Invite Brother**
3. Fill in their name, email, degree, role
4. They receive a welcome email with login instructions
5. They set their password and land on the brother portal

---

## Custom Domain (optional)

1. Buy a domain (namecheap.com, Google Domains, etc.) — `lodgeos.io` or `lodgeos.app` (~$12/yr)
2. Vercel → Your project → **Settings → Domains**
3. Add your domain → follow DNS instructions
4. Update `NEXT_PUBLIC_APP_URL` env var to your new domain
5. Update Supabase Auth redirect URL to match

---

## Making Money: Getting Your First Lodges

### Low-hanging fruit:
1. **Your own lodge first** — use it, perfect it, get testimonials
2. **Other lodges you know** — reach out to brothers in other lodges
3. **NC Grand Lodge** — contact the Grand Secretary, propose a district deal
4. **Masonic Facebook groups** — thousands of secretaries complaining about paperwork
5. **Reddit r/freemasonry** — 40k+ members, many are secretaries
6. **Prince Hall lodges** — largely underserved by tech

### Positioning:
- Lead with the secretary pain: "Stop chasing dues. Stop sending texts. Stop updating spreadsheets."
- Offer to set up their first lodge free as a demo
- The $39 Pro plan is less than most lodges spend on paper and stamps per year

### Revenue milestones:
- 1 lodge = $39/mo (prove it works)
- 10 lodges = $390/mo (side income)
- 25 lodges = $975/mo (car payment covered)
- 50 lodges = $1,950/mo (mortgage covered)
- 100 lodges = $3,900/mo (quit the day job, eventually)

---

## Tech Stack Summary

| Layer | Service | Cost |
|-------|---------|------|
| Database + Auth | Supabase | Free up to 500MB |
| Hosting | Vercel | Free |
| Email | Resend | Free up to 3k/mo |
| Payments | Stripe | 2.9% + 30¢ per transaction |
| Domain | Namecheap | ~$12/yr |
| **Total fixed cost** | | **~$12/year** |

Stripe fees only apply when money moves. A lodge paying $39/mo costs you ~$1.43 in Stripe fees. Net: $37.57/lodge/month.

---

## File Structure

```
lodgeos/
├── app/
│   ├── page.tsx                    # LodgeOS marketing homepage
│   ├── [slug]/                     # Public lodge website
│   │   ├── page.tsx                # Lodge public site
│   │   └── petition/page.tsx       # Public petition form
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── callback/route.ts
│   │   └── signout/route.ts
│   ├── onboarding/
│   │   ├── setup/page.tsx          # Step 1: Lodge info
│   │   ├── brand/page.tsx          # Step 2: Colors & content
│   │   ├── members/page.tsx        # Step 3: Add members
│   │   ├── billing/page.tsx        # Step 4: Plan selection
│   │   └── done/page.tsx           # Step 5: Launch!
│   ├── super-admin/
│   │   ├── page.tsx                # MRR, all lodges overview
│   │   └── lodges/page.tsx         # Manage all lodges
│   ├── lodge/[slug]/               # Per-lodge admin dashboard
│   │   ├── dashboard/              # Overview + quick actions
│   │   ├── members/                # Roster + invite
│   │   ├── dues/                   # Dues tracking + payments
│   │   ├── petitions/              # Review applications
│   │   ├── events/                 # Calendar management
│   │   ├── communications/         # Send notices
│   │   ├── documents/              # File library
│   │   ├── degrees/                # Degree tracker
│   │   └── settings/               # No-code config
│   ├── portal/                     # Brother self-service
│   │   ├── page.tsx                # Dashboard
│   │   ├── dues/page.tsx           # Pay dues online
│   │   └── profile/page.tsx        # Update info
│   └── api/
│       ├── dues/checkout/          # Stripe dues session
│       ├── dues/remind/            # Blast reminder emails
│       ├── billing/subscribe/      # Platform subscription
│       ├── billing/portal/         # Stripe billing portal
│       ├── members/invite/         # Invite + welcome email
│       └── webhooks/stripe/        # Payment webhooks
├── lib/
│   ├── supabase/client.ts
│   ├── supabase/server.ts
│   ├── stripe/index.ts
│   ├── email/index.ts
│   └── schema.sql                  # Full DB schema — paste into Supabase
├── types/index.ts                  # All TypeScript types + PLANS config
├── middleware.ts                   # Route protection
└── .env.example                    # All required env vars
```

---

## Single-Lodge Deployment

This deployment is configured for one lodge (Psalms of Job Lodge #1827)
rather than the general multi-tenant LodgeOS product:

- **Root `/`** renders Psalms of Job's public lodge page directly
  (`app/page.tsx` imports and calls the same component as
  `app/[slug]/page.tsx`, with the slug hardcoded — one source of truth,
  not two files that can drift apart).
- **The original multi-tenant marketing homepage** (features, pricing,
  "Start Free Trial") is preserved at `/start`, not deleted, in case
  this ever needs to onboard other lodges again.
- Everything under `/lodge/[slug]/*` and `/[slug]/petition` still works
  exactly as before — this only changes what renders at the bare root
  URL.

If this ever needs to serve multiple lodges again: swap `app/page.tsx`
back to the original marketing content (or delete it and let `/start`
become the new root), and remove the hardcoded `LODGE_SLUG` constant.

---

## Officer Roles & Permissions

`tenant_role` on `tenant_members` is the real permission field (see
`lib/migrations/004_officer_role_tiers.sql`). It's separate from
`lodge_role`, which stays a free-text DISPLAY label ("Senior Warden" vs
"Junior Warden") — two Wardens hold the same `tenant_role` ('warden')
and therefore the same system access, but `lodge_role` still shows their
distinct titles on rosters.

| Tier | Access |
|---|---|
| `secretary` / `admin` | Full lodge management — same access as before this migration |
| `worshipful_master` | Meetings, events, communications; read-only finances |
| `treasurer` | Full financial access (dues, reminders); read-only roster |
| `warden` | Meetings, attendance, roster (Senior or Junior — same tier, different `lodge_role` title) |
| `deacon` | Attendance, degree progress (Senior or Junior — same tier, different `lodge_role` title) |
| `member` | Brother portal only — no admin dashboard access |

**Route-level restrictions currently in place** (not every officer tier
can do everything):
- Recording/sending dues reminders: `secretary`, `treasurer`,
  `worshipful_master`, `admin` only
- Approving/denying petitions: `secretary`, `worshipful_master`, `admin`
  only — membership decisions traditionally rest with lodge leadership
- Inviting new members: `secretary`, `worshipful_master`, `admin` only,
  **and** only an existing `secretary`/`admin` can grant someone else
  the `secretary` or `admin` tier (a Worshipful Master inviting a new
  member cannot hand out full admin access, even though the WM can
  invite at all)

Everywhere else (attendance, degree progress, communications, event
invites), any officer tier has access — those didn't have a clear
reason to exclude specific tiers, so they weren't artificially
restricted.

**Extending this further:** `lib/auth/requireTenantAdmin.ts` exports
`requireTenantRole(tenantId, allowedTiers)` for any future route that
needs to restrict to specific tiers. `requireTenantAdmin(tenantId)`
remains available as shorthand for "any officer tier, don't care which."

**Database-layer note:** `is_tenant_admin()` (the Postgres function
backing most RLS write policies) treats all six officer tiers as one
undifferentiated "has admin-ish access" bucket — it does not itself
enforce that only a Treasurer can touch financial tables. Fine-grained
per-tier restriction happens at the application layer
(`requireTenantRole`), not in that shared SQL function. If a route is
added that writes directly via a Supabase client without going through
`requireTenantRole` first, it will pass RLS for any officer tier
regardless of which tiers "should" be allowed.

---

Built by Clyde Lazenby
Psalms of Job Lodge #1827 · F∴ & A∴M∴
clydelazenby@gmail.com
