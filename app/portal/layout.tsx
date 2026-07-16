import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
<<<<<<< HEAD
  const supabase = createClient()
=======
  const supabase = await createClient()
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('*, tenants(name, number, primary_color, secondary_color)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) redirect('/onboarding/setup')

  const tenant = (membership as any).tenants

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      <header style={{ background: '#141C2E', borderBottom: '1px solid rgba(201,168,76,0.15)', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#C9A84C', letterSpacing: '0.08em' }}>{tenant?.name} #{tenant?.number}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#B8B0A0', letterSpacing: '0.1em' }}>BROTHER PORTAL</div>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {[['Dashboard', '/portal'], ['Dues', '/portal/dues'], ['Events', '/portal/events'], ['Profile', '/portal/profile']].map(([l, h]) => (
            <Link key={l} href={h} style={{ fontFamily: 'Cinzel, serif', fontSize: '0.68rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.05em' }}>{l}</Link>
          ))}
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#C9A84C' }}>
            {profile?.first_name}
          </span>
        </div>
      </header>
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {children}
      </main>
    </div>
  )
}
