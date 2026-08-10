import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Matches the officer tiers from lib/migrations/004_officer_role_tiers.sql
// and the same set already used correctly in app/auth/login/page.tsx.
// This route previously only recognized 'admin'/'secretary' — a stale
// check that predates the officer-tiers migration — meaning a
// Treasurer, Warden, Deacon, or Worshipful Master confirming their
// email via this callback would be silently routed to the plain
// member portal instead of their real dashboard.
const OFFICER_TIERS = new Set(['admin', 'secretary', 'worshipful_master', 'treasurer', 'warden', 'deacon'])

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/portal'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if lodge admin or brother
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('platform_role').eq('id', user.id).single()
        if (profile?.platform_role === 'super_admin') {
          return NextResponse.redirect(`${origin}/super-admin`)
        }

        const { data: membership } = await supabase
          .from('tenant_members')
          .select('tenant_role, tenants(slug)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1)
          .single()

        if (membership) {
          const slug = (membership.tenants as any)?.slug
          if (OFFICER_TIERS.has(membership.tenant_role)) {
            return NextResponse.redirect(`${origin}/lodge/${slug}/dashboard`)
          }
          return NextResponse.redirect(`${origin}/portal`)
        }

        return NextResponse.redirect(`${origin}/onboarding/setup`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
}
