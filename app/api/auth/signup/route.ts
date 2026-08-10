import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Matches the pattern of app/api/auth/login/route.ts, with one
 * deliberate, important difference: this route does NOT set the
 * lodgeos_user_id/lodgeos_role cookies the way login does.
 *
 * The existing signup page (app/auth/signup/page.tsx) calls
 * supabase.auth.signUp() with emailRedirectTo set — meaning the
 * account is created but NOT YET VERIFIED until the person clicks the
 * confirmation link in their email. There is no fully-authenticated
 * session to build custom auth cookies from at this point. Setting
 * lodgeos_user_id/lodgeos_role here, before email confirmation, would
 * let an unverified account holder look "logged in" to any code that
 * trusts those cookies as a fallback (see requireTenantAdmin.ts) —
 * genuinely worse than the incident this whole auth chain was already
 * fixed for tonight. The real Supabase session cookie IS set by
 * signUp() itself via the cookies.setAll() handler below, same as it
 * always has been — that's correct and unrelated to the custom cookie
 * question.
 *
 * This route exists to give the client a consistent, single fetch-and-
 * JSON pattern (matching login) instead of calling the Supabase client
 * directly from the page — useful if a mobile client or other consumer
 * ever needs signup without shipping the Supabase JS SDK.
 */
export async function POST(request: NextRequest) {
  const cookiesToSet: { name: string; value: string; options: any }[] = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(newCookies: any[]) {
          newCookies.forEach((cookie) => cookiesToSet.push(cookie))
        },
      },
    }
  )

  const body = await request.json()
  const { email, password, firstName, lastName } = body

  if (!email || !password || !firstName || !lastName) {
    return NextResponse.json(
      { error: 'First name, last name, email, and password are all required.' },
      { status: 400 }
    )
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      emailRedirectTo: `${appUrl}/auth/callback`,
    },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Deliberately NOT setting lodgeos_user_id/lodgeos_role here — see
  // the file-level comment above. The account exists but is not yet
  // confirmed; the person still needs to click the email link before
  // logging in for real via /api/auth/login, which is where those
  // cookies get set, after a genuine password-verified session exists.
  const response = NextResponse.json({
    success: true,
    needsEmailConfirmation: !data.session,
    redirectTo: '/onboarding/setup',
  })

  cookiesToSet.forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  })

  return response
}
