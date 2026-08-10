import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Matches app/api/auth/login/route.ts's pattern, as the logout
 * counterpart. Real, specific reason this needed to be a NEW route
 * rather than just calling the existing app/auth/signout/route.ts:
 * that route calls supabase.auth.signOut() — clearing the real
 * Supabase session — but never clears lodgeos_user_id/lodgeos_role,
 * the two custom cookies login.ts sets. That's a genuine, if minor,
 * inconsistency: a user could "sign out" and still be carrying cookies
 * that identify who they were, even though nothing currently trusts
 * those cookies for privilege without a real database check (see the
 * requireTenantAdmin.ts security fix from earlier in this incident) —
 * still worth closing properly rather than leaving stale identity
 * cookies lying around after logout.
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

  await supabase.auth.signOut()

  const response = NextResponse.json({ success: true, redirectTo: '/auth/login' })

  cookiesToSet.forEach((cookie) => {
    response.cookies.set(cookie.name, cookie.value, cookie.options)
  })

  // Explicitly clear both custom cookies login.ts sets. maxAge: 0
  // (rather than a future expiry) tells the browser to delete the
  // cookie immediately — same path ('/') as when they were originally
  // set, since a cookie can only be cleared by a request matching its
  // original path.
  response.cookies.set('lodgeos_user_id', '', { path: '/', maxAge: 0 })
  response.cookies.set('lodgeos_role', '', { path: '/', maxAge: 0 })

  return response
}
