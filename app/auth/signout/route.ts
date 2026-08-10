import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const response = NextResponse.redirect(new URL('/auth/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))

  // Matches the fix in the new api/auth/logout/route.ts — this route
  // is what the real Sign Out button in app/lodge/[slug]/layout.tsx
  // actually calls (a plain form POST, deliberately left as-is rather
  // than rewired to the new API route, since a zero-JS form submit is
  // more resilient than a fetch call for something as important as
  // signing out). Clearing the custom cookies here too, so behavior is
  // consistent no matter which of the two logout paths gets used.
  response.cookies.set('lodgeos_user_id', '', { path: '/', maxAge: 0 })
  response.cookies.set('lodgeos_role', '', { path: '/', maxAge: 0 })

  return response
}
