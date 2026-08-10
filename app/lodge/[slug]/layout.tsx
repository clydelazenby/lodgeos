import { redirect, notFound } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import Link from 'next/link'
import { AiSecretaryPanel, AiSecretaryLauncherButton } from '@/components/lodge/AiSecretaryPanel'
import { ResponsiveNavShell } from '@/components/lodge/ResponsiveNavShell'
import { cookies } from 'next/headers'
import { can, type Capability } from '@/lib/auth/permissions'
import { NoticeBell } from '@/components/lodge/NoticeBell'
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

  if (membership && membership.tenant_role === 'member') {
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
  const allow = (c: Capability) => can(viewerRole, c, viewerIsSuperAdmin)

  const allNavEntries: ({ label: string; href: string; need?: Capability } | { label: string; need?: Capability; items: { label: string; href: string; need?: Capability }[] })[] = [
    { label: 'Dashboard', href: `${base}/dashboard` },
    // Top-level, beside Dashboard, because drafting minutes is not a
    // sub-task of anything — and because a tool nobody can find is a
    // tool nobody uses. The floating button remains for a question
    // asked in passing; this is where the writing happens.
    { label: 'AI Secretary', href: `${base}/secretary` },
    {
      label: 'Meetings',
      items: [
        { label: 'Lodge Room', href: `${base}/lodge-room` },
        { label: 'Meeting Mode', href: `${base}/meeting`, need: 'meetings' },
        { label: 'Attendance', href: `${base}/attendance`, need: 'meetings' },
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
        { label: 'Transition', href: `${base}/transition`, need: 'settings' },
      ],
    },
  ]

  /**
   * Drop what this officer cannot use, and drop a section that ends up
   * empty — a "Lodge" heading that opens onto nothing is worse than no
   * heading. Entries with no `need` are open to every officer tier.
   *
   * This is presentation only. Every route behind these links re-checks
   * the tier server-side; see lib/auth/permissions.ts.
   */
  const navEntries = allNavEntries
    .map((entry) => {
      if (!('items' in entry)) return entry
      const items = entry.items.filter((i) => !i.need || allow(i.need))
      return items.length ? { ...entry, items } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> =>
      entry !== null && (!('href' in entry) || !entry.need || allow(entry.need))
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
