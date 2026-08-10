import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Signing out. Called by the plain form POST in the portal header and
 * the lodge header — deliberately a zero-JS form submit rather than a
 * fetch, since it is more resilient than JavaScript for something as
 * important as ending a session.
 *
 * THE 303 IS THE WHOLE POINT, do not drop it back to a bare redirect().
 *
 * NextResponse.redirect() defaults to 307 Temporary Redirect, and 307
 * PRESERVES THE METHOD. The browser therefore re-issued the request as
 * POST /auth/login — a page route with no POST handler — and the
 * brother landed on a blank white page, signed out but with no way to
 * see it. 303 See Other exists for exactly this: "your POST succeeded,
 * now GET this other resource."
 *
 * The destination is built from the request's own URL rather than
 * NEXT_PUBLIC_APP_URL so a brother signing out stays on the host he was
 * already using — otherwise signing out on a preview deployment, or on
 * the bare domain, bounces him to a different origin than the one his
 * cookies were set on.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const response = NextResponse.redirect(new URL('/auth/login', request.url), { status: 303 })

  // Clearing the custom cookies here too, so behaviour is consistent no
  // matter which of the two logout paths gets used. maxAge: 0 tells the
  // browser to delete them immediately, and the path must match the one
  // they were set with ('/') or the clear silently does nothing.
  response.cookies.set('lodgeos_user_id', '', { path: '/', maxAge: 0 })
  response.cookies.set('lodgeos_role', '', { path: '/', maxAge: 0 })

  return response
}
