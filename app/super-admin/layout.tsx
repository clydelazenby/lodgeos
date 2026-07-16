import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
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
      <header style={{ background: '#141C2E', borderBottom: '1px solid rgba(201,168,76,0.15)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
<<<<<<< HEAD
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.15em' }}>LODGEOS</span>
=======
          <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.15em' }}>LODGEOS</span>
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', background: 'rgba(192,57,43,0.2)', color: '#E74C3C', border: '1px solid rgba(192,57,43,0.3)', padding: '3px 10px', letterSpacing: '0.1em' }}>SUPER ADMIN</span>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {navItems.map(({ label, href }) => (
            <Link key={href} href={href} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.68rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.08em' }}>{label}</Link>
          ))}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#C9A84C' }}>{profile?.first_name}</span>
        </div>
      </header>
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        {children}
      </main>
    </div>
  )
}
