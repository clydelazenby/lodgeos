import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/portal'

  if (code) {
    const supabase = createClient()
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
          if (membership.tenant_role === 'admin' || membership.tenant_role === 'secretary') {
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
