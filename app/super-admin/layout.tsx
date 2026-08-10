import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Toaster } from '@/components/ui/Toaster'

/**
 * PRODUCTION INCIDENT FIX — read before changing.
 *
 * A prior edit replaced this file's real authentication check (verify
 * a live Supabase session exists, AND verify profiles.platform_role in
 * the database) with a version that only reads the `lodgeos_role`
 * cookie and does nothing else — no session check, no database read.
 * The original, correct logic was left commented out in git history
 * rather than deleted, which is how this was found and restored.
 *
 * This matters even beyond the specific incident under investigation:
 * a cookie-only check with no underlying session validation means
 * anyone who could ever get that cookie set to `super_admin` — through
 * any bug, anywhere — would have full platform access with no other
 * verification standing in the way. Restoring the real check here.
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('platform_role, first_name').eq('id', user.id).single()
  if (profile?.platform_role !== 'super_admin') redirect('/')

  const navItems = [
    { label: 'Overview', href: '/super-admin' },
    { label: 'Lodges', href: '/super-admin/lodges' },
    { label: 'Billing', href: '/super-admin/billing' },
    { label: 'Announcements', href: '/super-admin/announcements' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      {/* height was fixed at 60px with a nowrap row of five items —
          brand, badge, four nav links and a name. On a phone that ran
          straight off the side of the screen with no way to reach the
          links. minHeight lets it wrap to two rows instead. */}
      <header className="lodgeos-sa-header" style={{ background: '#141C2E', borderBottom: '1px solid rgba(201,168,76,0.15)', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 2rem', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.15em' }}>LODGEOS</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', background: 'rgba(192,57,43,0.2)', color: '#EC5B4B', border: '1px solid rgba(192,57,43,0.3)', padding: '3px 10px', letterSpacing: '0.1em' }}>SUPER ADMIN</span>
        </div>
        <div className="lodgeos-sa-nav" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {navItems.map(({ label, href }) => (
            <Link key={href} href={href} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.68rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.08em' }}>{label}</Link>
          ))}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#C9A84C' }}>{profile?.first_name}</span>
        </div>
      </header>
      <Toaster />
      <main className="lodgeos-app-main" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
