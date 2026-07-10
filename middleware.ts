import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  console.log('MIDDLEWARE PATH:', request.nextUrl.pathname)
  console.log('MIDDLEWARE USER:', user?.id)
  // Protect lodge admin routes
  if (!user && request.nextUrl.pathname.startsWith('/lodge/')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Protect super admin routes
if (request.nextUrl.pathname.startsWith('/super-admin')) 
{  console.log('SUPER ADMIN ROUTE HIT')  
  console.log('USER:', user?.id)   
  return supabaseResponse
}

  // Protect brother portal
  if (!user && request.nextUrl.pathname.startsWith('/portal')) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  // Protect onboarding
  if (!user && request.nextUrl.pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/auth/signup', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/lodge/:path*', '/super-admin/:path*', '/portal/:path*', '/onboarding/:path*'],
}
