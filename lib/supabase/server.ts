

import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * PRODUCTION INCIDENT FIX — read before changing.
 *
 * This file previously used the LEGACY Supabase SSR cookie method
 * shape (get/set/remove, one cookie at a time). middleware.ts uses the
 * CURRENT method shape (getAll/setAll, all cookies at once) — these
 * are two different, incompatible versions of the @supabase/ssr cookie
 * interface. Per Supabase's own current documentation
 * (supabase.com/docs/guides/auth/server-side/nextjs), getAll/setAll is
 * the correct, current pattern; the client examples they publish use
 * it exclusively.
 *
 * Mixing the two shapes across middleware and server.ts is a real,
 * documented source of session-read failures: middleware refreshes and
 * writes the session cookie using the new shape, and a server client
 * built with the old shape can fail to correctly read that same
 * cookie back in a route handler — meaning supabase.auth.getUser()
 * can return null for a genuinely, currently logged-in user. This is
 * suspected to be a direct contributor to the "Unauthorized on every
 * save" production incident, since every write route calls
 * createClient() from this file before checking auth.
 *
 * Standardized on getAll/setAll here to match middleware.ts exactly.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Setting cookies from a Server Component (as opposed to a
            // Route Handler or Server Action) will throw — this is
            // expected and safe to ignore when middleware is already
            // refreshing the session, per Supabase's own documented
            // guidance for this exact try/catch pattern.
          }
        },
      },
    }
  )
}

// Not async — createSupabaseClient() returns a real client directly,
// no Promise involved. (A prior caller awaited this unnecessarily;
// awaiting a non-Promise value doesn't throw in JS, but it's
// misleading — this function's signature makes that call site
// technically fine either way, awaited or not.)
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
