import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const cookiesToSet: {
    name: string
    value: string
    options: any
  }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(newCookies: any[]) {
          newCookies.forEach((cookie) => {
            cookiesToSet.push({
              name: cookie.name,
              value: cookie.value,
              options: cookie.options,
            })
          })
        },
      },
    }
  )

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const body = await request.json()

  const email = body.email
  const password = body.password

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email and password are required.' },
      { status: 400 }
    )
  }

  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    })

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message || 'Invalid email or password.' },
      { status: 401 }
    )
  }

  const user = authData.user

  console.log('LOGIN ROUTE USER ID:', user.id)
  console.log('LOGIN ROUTE USER EMAIL:', user.email)

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  console.log('LOGIN ROUTE PROFILE:', profile)
  console.log('LOGIN ROUTE PROFILE ERROR:', profileError)

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    )
  }

  let redirectTo = '/onboarding/setup'

  if (profile?.platform_role === 'super_admin') {
    redirectTo = '/super-admin'
  } else {
    const { data: membership, error: membershipError } = await admin
      .from('tenant_members')
      .select('tenant_id, tenant_role, tenants(slug)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    console.log('LOGIN ROUTE MEMBERSHIP:', membership)
    console.log('LOGIN ROUTE MEMBERSHIP ERROR:', membershipError)

    if (membership) {
      const slug = (membership.tenants as any)?.slug

      const officerTiers = [
        'admin',
        'secretary',
        'worshipful_master',
        'treasurer',
        'warden',
        'deacon',
      ]

      if (officerTiers.includes(membership.tenant_role)) {
        redirectTo = `/lodge/${slug}/dashboard`
      } else {
        redirectTo = '/portal'
      }
    }
  }
console.log('COOKIES TO SET', cookiesToSet)
const response = NextResponse.json({
  redirectTo,
})

cookiesToSet.forEach((cookie) => {
  response.cookies.set(cookie.name, cookie.value, cookie.options)
})

response.cookies.set('lodgeos_user_id', user.id, {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
})

response.cookies.set('lodgeos_role', profile?.platform_role || 'user', {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
})

return response
}