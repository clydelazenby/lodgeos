import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Toaster } from '@/components/ui/Toaster'
import { PortalNav } from '@/components/portal/PortalNav'
import { HelpButton } from '@/components/help/HelpButton'
import { noteFirstSignIn } from '@/lib/firstSignIn'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: membership } = await supabase
    .from('tenant_members')
    .select('*, tenants(name, number, slug, primary_color, secondary_color)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) redirect('/onboarding/setup')

  /**
   * "He got in" — the notice that proves the invitation worked.
   *
   * Guarded on the column so this costs nothing after the first visit:
   * a brother who has signed in before never reaches the helper. An
   * invited brother arrives on a one-time link rather than through the
   * login route, which is why it hangs here rather than there.
   */
  if (!(membership as any).first_signin_at) {
    await noteFirstSignIn((membership as any).tenant_id, user.id)
  }

  const tenant = (membership as any).tenants

  /**
   * Every brother now lands here, officers included — so an officer
   * needs a way back to the lodge side. Without this the Secretary
   * signs in, arrives at his own dues page, and has no route to the
   * roster or the minute book except typing a URL.
   *
   * Shown for any tier above plain member. It is a convenience link,
   * not a permission: the lodge layout and every route behind it
   * re-check the tier server-side.
   */
  const isOfficer = (membership as any).tenant_role && (membership as any).tenant_role !== 'member'
  const isSuperAdmin = profile?.platform_role === 'super_admin'
  const showLodgeLink = Boolean((isOfficer || isSuperAdmin) && tenant?.slug)

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      <header className="lodgeos-portal-header" style={{ background: '#141C2E', borderBottom: '1px solid rgba(201,168,76,0.15)', minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', padding: '0.5rem 1.5rem', position: 'sticky', top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#C9A84C', letterSpacing: '0.08em' }}>{tenant?.name} #{tenant?.number}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#B8B0A0', letterSpacing: '0.1em' }}>BROTHER PORTAL</div>
        </div>
        {/* The ? sits beside the menu — on a phone that means directly
            beside the ☰, which is the one control a brother has
            already found. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <HelpButton />
          <PortalNav
            firstName={profile?.first_name}
            lodgeHref={showLodgeLink ? `/lodge/${tenant.slug}/dashboard` : undefined}
          />
        </div>
      </header>
      <Toaster />
      <main className="lodgeos-app-main" style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {children}
      </main>
    </div>
  )
}
