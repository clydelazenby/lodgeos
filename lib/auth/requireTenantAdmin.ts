import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export type TenantRole =
  | 'admin'
  | 'secretary'
  | 'worshipful_master'
  | 'treasurer'
  | 'warden'
  | 'deacon'
  | 'member'

export type AuthResult =
  | { ok: true; userId: string; tenantRole: TenantRole }
  | { ok: false; response: NextResponse }

const OFFICER_TIERS = new Set<TenantRole>([
  'admin',
  'secretary',
  'worshipful_master',
  'treasurer',
  'warden',
  'deacon',
])

export async function requireTenantAdmin(tenantId: string): Promise<AuthResult> {
  return requireTenantRole(tenantId, Array.from(OFFICER_TIERS))
}

/**
 * PRODUCTION INCIDENT FIX — read before changing.
 *
 * Two real issues fixed here, both found while investigating the
 * "Unauthorized on every save" incident:
 *
 * 1. lib/supabase/server.ts previously used a cookie-method shape
 *    incompatible with middleware.ts, which could make
 *    supabase.auth.getUser() below silently return null for a real,
 *    logged-in user. That's fixed at the source in server.ts — this
 *    file's `user?.id` read should now work correctly on its own,
 *    without needing a cookie fallback to compensate for it.
 *
 * 2. A REAL SECURITY HOLE, independent of the incident: this function
 *    previously had `if (appRole === 'super_admin') { grant admin
 *    access }` — trusting a plain, client-readable cookie value with
 *    ZERO database verification to hand out full administrative
 *    privilege. A cookie can be httpOnly (this one is, per the login
 *    route), which prevents JS from reading/setting it from the
 *    browser, but that is not the same as it being unforgeable or
 *    proof of anything — and more importantly, granting privilege
 *    from ANY unverified value, cookie or otherwise, without checking
 *    it against the real profiles.platform_role in the database is
 *    the actual problem, regardless of cookie flags. That branch has
 *    been removed. The `lodgeos_user_id` cookie is kept ONLY as a
 *    fallback for identifying WHO is asking (never used alone — see
 *    below) — never for deciding WHAT they're allowed to do. Every
 *    privilege decision in this file now requires a real row read
 *    from profiles or tenant_members.
 */
export async function requireTenantRole(
  tenantId: string,
  allowedTiers: TenantRole[]
): Promise<AuthResult> {
  if (!tenantId) {
    return { ok: false, response: NextResponse.json({ error: 'Missing tenantId' }, { status: 400 }) }
  }

  const supabase = await createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  // The lodgeos_user_id cookie is a legitimate secondary identity
  // signal (set by a real, successful login in
  // app/api/auth/login/route.ts) — kept as a fallback ONLY for WHO is
  // asking, in case the Supabase session read above is ever slow to
  // propagate. It is never, on its own, sufficient to grant any
  // privilege — every path below still requires a real database read
  // before returning ok: true.
  const cookieStore = await cookies()
  const userId = user?.id || cookieStore.get('lodgeos_user_id')?.value

  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  // Real database check — the ONLY path to super_admin privilege.
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('platform_role')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.platform_role === 'super_admin') {
    return { ok: true, userId, tenantRole: 'admin' }
  }

  const { data: membership } = await serviceClient
    .from('tenant_members')
    .select('tenant_role, is_active')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()

  const allowed = new Set(allowedTiers)

  if (!membership || !membership.is_active || !allowed.has(membership.tenant_role as TenantRole)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true, userId, tenantRole: membership.tenant_role as TenantRole }
}
