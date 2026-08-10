import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * PRODUCTION INCIDENT FIX — read this before touching this file again.
 *
 * A prior edit (made outside this session, via a different AI coding
 * tool working on the same repo) introduced two custom cookies —
 * `lodgeos_user_id` and `lodgeos_role` — and made the entire
 * authentication check depend on them existing:
 *
 *   const appUserId = request.cookies.get('lodgeos_user_id')?.value
 *   const hasAuth = Boolean(appUserId)
 *   if (!hasAuth && isProtectedRoute) { redirect to login }
 *
 * The bug: NOTHING in this codebase ever SETS those two cookies. They
 * were read here but never written anywhere — not in the login flow,
 * not in middleware itself, nowhere. That means `appUserId` was always
 * undefined, `hasAuth` was always false, and every single request to
 * every protected route was treated as unauthenticated — regardless of
 * whether the user had a real, valid Supabase session. This is what
 * caused "Unauthorized" on every save/upload in production: the real
 * session check below (supabase.auth.getUser()) was being computed
 * correctly and then completely ignored in favor of a fake cookie that
 * could never be true.
 *
 * The fix is to trust `user` — the real, live-verified Supabase
 * session, fetched via getUser() (not getSession(), per Supabase's own
 * SSR docs: "Never trust supabase.auth.getSession() inside server code
 * such as middleware... It's safe to trust getUser()") — as the single
 * source of truth for "is this request authenticated," the way this
 * file worked before the custom-cookie change was introduced.
 *
 * If a future change wants to add custom session cookies for some
 * other purpose, that's fine — but they must never become the THING
 * that decides authentication unless something in this codebase
 * actually sets them first. Grep the whole repo for
 * `lodgeos_user_id`/`lodgeos_role` before reintroducing any check like
 * this, and confirm a real .set() call exists somewhere in the login
 * flow, not just a .get() in middleware.
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // The real, live-verified session — this was always being computed
  // correctly. The bug was that it stopped being TRUSTED.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtectedRoute =
    path.startsWith('/lodge/') ||
    path.startsWith('/super-admin') ||
    path.startsWith('/portal') ||
    path.startsWith('/onboarding')

  if (!user && isProtectedRoute) {
    const loginPath = path.startsWith('/onboarding') ? '/auth/signup' : '/auth/login'
    return NextResponse.redirect(new URL(loginPath, request.url))
  }

  // Super-admin route protection: this needs the user's REAL
  // platform_role from the database, not a cookie nothing sets. This
  // matches the pattern already used correctly in
  // app/super-admin/layout.tsx (which queries profiles.platform_role
  // directly) — middleware does the same real lookup here rather than
  // trusting an unset cookie.
  if (user && path.startsWith('/super-admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('platform_role')
      .eq('id', user.id)
      .single()

    if (profile?.platform_role !== 'super_admin') {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/lodge/:path*', '/super-admin/:path*', '/portal/:path*', '/onboarding/:path*'],
}
