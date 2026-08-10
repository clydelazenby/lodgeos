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

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id, email, platform_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json(
      { error: profileError.message },
      { status: 500 }
    )
  }

  /**
   * WHERE A BROTHER LANDS AFTER SIGNING IN.
   *
   * Previously every officer tier — Master, Treasurer, Warden, Deacon —
   * landed on the lodge admin dashboard, and only plain members reached
   * the portal. That put the administrative side of the app in front of
   * brothers whose day-to-day use is their own dues, events and profile.
   *
   * Now: only a PLATFORM administrator lands on a lodge dashboard.
   * Everyone else, the Secretary included, starts in the brother portal.
   *
   * This changes the LANDING PAGE ONLY. Officers keep every permission
   * they had — a Treasurer still opens Dues, a Warden still records
   * attendance — reached from the "Lodge Administration" link in the
   * portal header, and still enforced server-side by requireTenantRole
   * and RLS. Nothing here is a security boundary.
   */
  let redirectTo = '/onboarding/setup'

  if (profile?.platform_role === 'super_admin') {
    // The Platform Overview exists to choose BETWEEN lodges. With one
    // lodge it is a wrapper around a single row, so go straight in.
    // Fetching two rows is enough to answer "more than one?" without
    // counting the whole table.
    const { data: lodges } = await admin
      .from('tenants')
      .select('slug')
      .limit(2)

    redirectTo =
      lodges && lodges.length === 1
        ? `/lodge/${lodges[0].slug}/dashboard`
        : '/super-admin'
  } else {
    const { data: membership, error: membershipError } = await admin
      .from('tenant_members')
      .select('tenant_id, tenant_role, tenants(slug)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (membershipError) {
      // A membership lookup failure is not the same as "no membership".
      // Falling through silently would route a real officer to the
      // new-lodge onboarding flow, so surface it instead.
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    // Any brother on a roster starts in the portal, whatever his office.
    if (membership) redirectTo = '/portal'
  }

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