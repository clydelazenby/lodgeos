import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AiSecretaryPanel } from '@/components/lodge/AiSecretaryPanel'
import { ResponsiveNavShell } from '@/components/lodge/ResponsiveNavShell'

export default async function LodgeAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { slug: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Get tenant by slug
  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', params.slug)
    .single()

  if (!tenant) notFound()

  // Verify user is admin/secretary of this lodge
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_role, lodge_role')
    .eq('tenant_id', tenant.id)
    .eq('user_id', user.id)
    .single()

  // Allow super admins too
  const { data: profile } = await supabase.from('profiles').select('platform_role, first_name').eq('id', user.id).single()

  if (!membership && profile?.platform_role !== 'super_admin') {
    redirect('/auth/login')
  }

  if (membership && membership.tenant_role === 'member') {
    redirect('/portal')
  }

  const base = `/lodge/${params.slug}`
  const navItems = [
    { label: 'Dashboard', href: `${base}/dashboard` },
<<<<<<< HEAD
    { label: 'Lodge Room', href: `${base}/lodge-room` },
    { label: 'Meeting Mode', href: `${base}/meeting` },
    { label: 'Analytics', href: `${base}/analytics` },
=======
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
    { label: 'Members', href: `${base}/members` },
    { label: 'Dues', href: `${base}/dues` },
    { label: 'Petitions', href: `${base}/petitions` },
    { label: 'Events', href: `${base}/events` },
    { label: 'Attendance', href: `${base}/attendance` },
    { label: 'Care', href: `${base}/care` },
    { label: 'Communications', href: `${base}/communications` },
    { label: 'Documents', href: `${base}/documents` },
    { label: 'Degrees', href: `${base}/degrees` },
    { label: 'Coverage', href: `${base}/bench` },
    { label: 'Reports', href: `${base}/reports` },
    { label: 'Transition', href: `${base}/transition` },
    { label: 'Settings', href: `${base}/settings` },
  ]

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
          <Link href={`/${params.slug}`} className="lodgeos-public-site-link" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Public Site ↗</Link>
          <span className="lodgeos-first-name" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#C9A84C', whiteSpace: 'nowrap' }}>{profile?.first_name}</span>
          <form action="/auth/signout" method="post">
            <button style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>Sign out</button>
          </form>
        </div>
      </header>

      <div style={{ display: 'flex' }}>
        <ResponsiveNavShell
          navItems={navItems}
          superAdminHref={profile?.platform_role === 'super_admin' ? '/super-admin' : null}
          homeHref="/"
        >
          {children}
        </ResponsiveNavShell>
      </div>

      <AiSecretaryPanel tenantId={tenant.id} />

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
