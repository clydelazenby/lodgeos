import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })

          supabaseResponse = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const appUserId = request.cookies.get('lodgeos_user_id')?.value
const appRole = request.cookies.get('lodgeos_role')?.value

console.log('APP COOKIE USER:', appUserId ?? 'NO APP COOKIE')
console.log('APP COOKIE ROLE:', appRole ?? 'NO APP ROLE')
  console.log('MIDDLEWARE PATH:', path)
  console.log('MIDDLEWARE USER:', user?.id ?? 'NO USER')

  const isProtectedRoute =
    path.startsWith('/lodge/') ||
    path.startsWith('/super-admin') ||
    path.startsWith('/portal') ||
    path.startsWith('/onboarding')

const hasAuth = Boolean(user || appUserId)

if (!hasAuth && isProtectedRoute) {
  const loginPath = path.startsWith('/onboarding')
    ? '/auth/signup'
    : '/auth/login'

  console.log('MIDDLEWARE REDIRECTING TO:', loginPath)

  return NextResponse.redirect(new URL(loginPath, request.url))
}

if (path.startsWith('/super-admin')) {
  const isSuperAdmin =
    user !== null || appRole === 'super_admin'

  if (!isSuperAdmin) {
    console.log('MIDDLEWARE BLOCKED SUPER ADMIN')
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
}

  return supabaseResponse
}

export const config = {
  matcher: [
    '/lodge/:path*',
    '/super-admin/:path*',
    '/portal/:path*',
    '/onboarding/:path*',
  ],
}
