import { redirect, notFound } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import Link from 'next/link'
import { AiSecretaryPanel, AiSecretaryLauncherButton } from '@/components/lodge/AiSecretaryPanel'
import { ResponsiveNavShell } from '@/components/lodge/ResponsiveNavShell'
import { cookies } from 'next/headers'
import { can, type Capability } from '@/lib/auth/permissions'
import { loadOverrides } from '@/lib/auth/capabilities'
import { noteFirstSignIn } from '@/lib/firstSignIn'
import { NoticeBell } from '@/components/lodge/NoticeBell'
import { Toaster } from '@/components/ui/Toaster'
import { HelpButton } from '@/components/help/HelpButton'
import { createClient } from '@/lib/supabase/server'

export default async function LodgeAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  // getSessionUser() and getTenantBySlug() are independent of each
  // other — the session doesn't determine which lodge the URL names —
  // so they run concurrently rather than one after the other. Both are
  // cache()-wrapped, so the page rendered inside this layout reuses
  // these exact results instead of re-querying.
  const [user, tenant] = await Promise.all([
    getSessionUser(),
    getTenantBySlug(params.slug),
  ])

  // PRODUCTION INCIDENT FIX: this previously gated entry on the
  // lodgeos_user_id cookie alone, with no live Supabase session check
  // at all — unlike super-admin/layout.tsx and requireTenantAdmin.ts
  // (both fixed in this same pass), the real database checks further
  // below in THIS file were already intact and correct, so this file
  // was not silently broken the same way — but it shared the same root
  // weakness: trusting a cookie's mere presence as sufficient, rather
  // than treating a real session as primary and the cookie as a
  // fallback identity signal only.
  const cookieStore = await cookies()
  const userId = user?.id || cookieStore.get('lodgeos_user_id')?.value

  if (!userId) {
    redirect('/auth/login')
  }

  if (!tenant) notFound()

  // Membership check and the super-admin escape hatch are likewise
  // independent lookups, so they also go out together instead of
  // serially. Both are needed before the access decision below.
  const [membership, profile] = await Promise.all([
    getMembership(tenant.id, userId),
    getProfile(userId),
  ])

  if (!membership && profile?.platform_role !== 'super_admin') {
    redirect('/auth/login')
  }

  /**
   * A brother on the 'member' tier belongs in the portal — UNLESS the
   * lodge has deliberately given him something (migration 035).
   *
   * The Chaplain who sends the sick-and-distressed notice is an
   * ordinary member and always was; before per-brother permissions the
   * only way to let him send it was to promote him a whole tier. Now
   * the Master grants him 'communications' and nothing else — but the
   * grant is worthless if this line still bounces him to the portal
   * before he can reach the page.
   *
   * So: one granted exception is enough to get in, and the nav below
   * shows him that one thing. Nothing else opens with him — every page
   * behind those links reads through RLS, which keys off tenant_role
   * and still says 'member'.
   */
  // An officer invited straight onto the lodge side never passes
  // through the portal layout, so the same notice hangs here too. Both
  // are guarded on the column and settled by the UPDATE's own filter,
  // so passing through both sends one email, not two.
  if (membership && !(membership as any).first_signin_at) {
    await noteFirstSignIn(tenant.id, userId)
  }

  const viewerOverrides = membership
    ? await loadOverrides(tenant.id, userId)
    : {}
  const hasGrantedException = Object.values(viewerOverrides).some(Boolean)

  if (membership && membership.tenant_role === 'member' && !hasGrantedException) {
    redirect('/portal')
  }

  /**
   * Unread notice count for the header envelope.
   *
   * head:true means Postgres returns the count without sending any
   * rows — this runs on every lodge page load, so it must stay a cheap
   * counting query and never fetch the notices themselves. Migration
   * 017 adds the partial index it uses.
   *
   * A brother who has never opened the page has a null timestamp, in
   * which case every non-draft notice counts.
   */
  const lastRead = (membership as any)?.communications_last_read_at ?? null
  const supabaseForCount = await createClient()
  let unreadQuery = supabaseForCount
    .from('communications')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id)
    .eq('is_draft', false)
  if (lastRead) unreadQuery = unreadQuery.gt('sent_at', lastRead)
  const { count: unreadCount } = await unreadQuery

  const base = `/lodge/${params.slug}`

  /**
   * Seventeen flat links became six top-level entries.
   *
   * Grouped by the QUESTION an officer is answering when they reach for
   * the nav, not by which database table a page happens to read:
   *
   * - Dashboard and Dues stay top-level because they are the two pages
   *   opened most often, and burying a daily destination one click
   *   deeper to tidy a menu is a bad trade.
   * - Meetings — everything about running a communication, in the order
   *   it happens: set the room, run the meeting, record who came, plan
   *   the next one.
   * - Brothers — everything about a person: the roster, their degree
   *   progress, men seeking admission, those in distress, and who is
   *   covering which station.
   * - Records — the things you produce or consult rather than act on.
   *   Analytics and Reports both live here because both answer "what
   *   happened", differing only in whether the output is a screen or a
   *   PDF.
   * - Lodge — configuration and the annual officer handover. Rarely
   *   touched, and grouped so it stops competing with daily work.
   *
   * Nothing was removed; every one of the seventeen pages is still
   * reachable and no URL changed.
   */
  const viewerRole = (membership as any)?.tenant_role ?? null
  const viewerIsSuperAdmin = profile?.platform_role === 'super_admin'
  const allow = (c: Capability) => can(viewerRole, c, viewerIsSuperAdmin, viewerOverrides)

  /**
   * Entries with no `need` are "open to every officer tier" — which was
   * an unambiguous statement while only officers were ever here. A
   * member admitted by a single granted exception is not an officer,
   * and the Dashboard, the Lodge Room and the roster are not what he
   * was given. He sees the thing he was given and nothing else.
   */
  const openToOfficers = viewerIsSuperAdmin || (!!viewerRole && viewerRole !== 'member')

  const allNavEntries: ({ label: string; href: string; need?: Capability } | { label: string; need?: Capability; items: { label: string; href: string; need?: Capability }[] })[] = [
    { label: 'Dashboard', href: `${base}/dashboard` },
    // Top-level, beside Dashboard, because drafting minutes is not a
    // sub-task of anything — and because a tool nobody can find is a
    // tool nobody uses. The floating button remains for a question
    // asked in passing; this is where the writing happens.
    { label: 'AI Secretary', href: `${base}/secretary` },
    // Top-level: giving work out is a weekly act for the Master and the
    // Wardens, and the tier that may do it is narrower than the section
    // it would otherwise sit in.
    { label: 'Assignments', href: `${base}/assignments`, need: 'assignments' },
    {
      label: 'Meetings',
      items: [
        { label: 'Lodge Room', href: `${base}/lodge-room` },
        { label: 'Meeting Mode', href: `${base}/meeting`, need: 'meetings' },
        { label: 'Attendance', href: `${base}/attendance`, need: 'meetings' },
        // The lodge's principal record. Under Meetings rather than
        // Records because writing them up is part of running a meeting,
        // and it is the officer who just ran one who does it.
        { label: 'Minutes', href: `${base}/minutes`, need: 'meetings' },
        { label: 'Events', href: `${base}/events` },
      ],
    },
    {
      label: 'Brothers',
      items: [
        { label: 'Members', href: `${base}/members` },
        { label: 'Degrees', href: `${base}/degrees`, need: 'meetings' },
        { label: 'Petitions', href: `${base}/petitions`, need: 'roster' },
        { label: 'Care', href: `${base}/care`, need: 'insight' },
        { label: 'Coverage', href: `${base}/bench`, need: 'insight' },
      ],
    },
    { label: 'Dues', href: `${base}/dues`, need: 'finance' },
    {
      label: 'Records',
      items: [
        { label: 'Documents', href: `${base}/documents` },
        { label: 'Communications', href: `${base}/communications`, need: 'communications' },
        { label: 'Analytics', href: `${base}/analytics`, need: 'insight' },
        { label: 'Reports', href: `${base}/reports`, need: 'insight' },
        // Narrower than the section it sits in: the page itself and the
        // RLS policy behind it restrict the trail to the administrative
        // office. 'settings' is the closest capability we have to that.
        { label: 'Audit Trail', href: `${base}/audit`, need: 'settings' },
      ],
    },
    {
      label: 'Lodge',
      items: [
        { label: 'Settings', href: `${base}/settings`, need: 'settings' },
        // The public site's photographs. Under Lodge because it is
        // configuration of what the world sees, not a record the lodge
        // keeps for itself.
        { label: 'Gallery', href: `${base}/gallery`, need: 'settings' },
        // No `need`: every officer may read who is being told what, and
        // everyone may switch his OWN off — which he cannot do on a page
        // he cannot open. Changing someone else's is checked in the page
        // and again in the route.
        { label: 'Notifications', href: `${base}/notifications` },
        // No `need`: what each chair is responsible for is not
        // officers' business kept from the craft, and the man who most
        // needs it is the one just appointed, who has the least access.
        { label: 'Officer Duties', href: `${base}/duties` },
        // Readable by every officer, editable by the administrative
        // office alone — the page enforces that itself. No `need` here
        // because who may do what is not a secret kept from the men it
        // governs, and a Deacon should be able to see that the document
        // library belongs to his chair without having to ask.
        { label: 'Permissions', href: `${base}/permissions` },
        { label: 'Transition', href: `${base}/transition`, need: 'settings' },
      ],
    },
    // Last, and with no `need`: it is documentation, and the officer
    // who cannot find the ? in the header will look for the word
    // "Help" in the menu.
    { label: 'Help', href: `${base}/help` },
  ]

  /**
   * Drop what this officer cannot use, and drop a section that ends up
   * empty — a "Lodge" heading that opens onto nothing is worse than no
   * heading. Entries with no `need` are open to every officer tier.
   *
   * This is presentation only. Every route behind these links re-checks
   * the tier server-side; see lib/auth/permissions.ts.
   */
  const visible = (need?: Capability) => (need ? allow(need) : openToOfficers)

  const navEntries = allNavEntries
    .map((entry) => {
      if (!('items' in entry)) return entry
      const items = entry.items.filter((i) => visible(i.need))
      return items.length ? { ...entry, items } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> =>
      entry !== null && (!('href' in entry) || visible(entry.need))
    )

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      {/* Top bar */}
      <header className="lodgeos-header-pad" style={{ position: 'sticky', top: 0, zIndex: 100, background: '#141C2E', borderBottom: '1px solid rgba(201,168,76,0.15)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: '#C9A84C', letterSpacing: '0.1em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            {tenant.name} <span style={{ color: '#8B6914' }}>#{tenant.number}</span>
          </div>
          <span className="lodgeos-role-badge" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', color: '#C9A84C', padding: '2px 8px', letterSpacing: '0.08em', flexShrink: 0 }}>
            {membership?.tenant_role?.toUpperCase() ?? 'SUPER ADMIN'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
          {/* Beside the AI Secretary and the bell, and never hidden at
              any width — the officer most likely to need it is the one
              on a phone in a lodge room, and the header items that
              collapse below 480px are the ones he can do without. */}
          <HelpButton />
          <AiSecretaryLauncherButton />
          <NoticeBell href={`${base}/communications`} count={unreadCount ?? 0} />
          <Link href={`/${params.slug}`} className="lodgeos-public-site-link" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Public Site ↗</Link>
          <span className="lodgeos-first-name" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#C9A84C', whiteSpace: 'nowrap' }}>{profile?.first_name}</span>
          <form action="/auth/signout" method="post">
            <button style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Sign out</button>
          </form>
        </div>
      </header>

      <div style={{ display: 'flex' }}>
        <ResponsiveNavShell
          navEntries={navEntries}
          superAdminHref={profile?.platform_role === 'super_admin' ? '/super-admin' : null}
          homeHref="/"
        >
          {children}
        </ResponsiveNavShell>
      </div>

      {/*
        * THE CONFIRMATIONS HAD NOWHERE TO LAND.
        *
        * lib/toast dispatches on a window event and one <Toaster/> per
        * layout listens. It was mounted on the portal and the
        * super-admin layouts and NOT here — so every notify.saved() on
        * the lodge side, and there are two dozen of them, fired into an
        * empty room. Saving a member's degree, deleting a document,
        * changing a dues rate: all of them succeeded silently, which is
        * indistinguishable from nothing happening at all.
        */}
      <Toaster />

      <AiSecretaryPanel
        tenantId={tenant.id}
        slug={params.slug}
        canSendNotices={allow('communications')}
      />

      {/* Header items that get tight on very small screens hide below
          480px, keeping Sign out (the one action genuinely needed)
          always reachable. Left padding on mobile clears the fixed
          hamburger button, which lives inside ResponsiveNavShell. */}
      <style>{`
        @media (max-width: 479px) {
          .lodgeos-role-badge, .lodgeos-public-site-link, .lodgeos-first-name { display: none; }
        }
        @media (max-width: 767px) {
          .lodgeos-header-pad { padding-left: 56px !important; }
        }
      `}</style>
    </div>
  )
}
