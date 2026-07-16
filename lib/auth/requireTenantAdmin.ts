<<<<<<< HEAD
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
=======
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type TenantRole = 'admin' | 'secretary' | 'worshipful_master' | 'treasurer' | 'warden' | 'deacon' | 'member'
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d

export type AuthResult =
  | { ok: true; userId: string; tenantRole: TenantRole }
  | { ok: false; response: NextResponse }

<<<<<<< HEAD
const OFFICER_TIERS = new Set<TenantRole>([
  'admin',
  'secretary',
  'worshipful_master',
  'treasurer',
  'warden',
  'deacon',
])

export async function requireTenantAdmin(
  tenantId: string
): Promise<AuthResult> {
  return requireTenantRole(tenantId, Array.from(OFFICER_TIERS))
}

export async function requireTenantRole(
  tenantId: string,
  allowedTiers: TenantRole[]
): Promise<AuthResult> {
  if (!tenantId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Missing tenantId' },
        { status: 400 }
      ),
    }
  }

  const cookieStore = await cookies()

  const appUserId = cookieStore.get('lodgeos_user_id')?.value
  const appRole = cookieStore.get('lodgeos_role')?.value

  const supabase = await createClient()
  const serviceClient = await createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const userId = user?.id || appUserId

  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    }
  }

  if (appRole === 'super_admin') {
    return {
      ok: true,
      userId,
      tenantRole: 'admin',
    }
  }

  const { data: profile } = await serviceClient
    .from('profiles')
    .select('platform_role')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.platform_role === 'super_admin') {
    return {
      ok: true,
      userId,
      tenantRole: 'admin',
    }
  }

  const { data: membership } = await serviceClient
    .from('tenant_members')
    .select('tenant_role, is_active')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()

  const allowed = new Set(allowedTiers)

  if (
    !membership ||
    !membership.is_active ||
    !allowed.has(membership.tenant_role as TenantRole)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      ),
    }
  }

  return {
    ok: true,
    userId,
    tenantRole: membership.tenant_role as TenantRole,
  }
}
=======
// The full set of tiers considered to have SOME kind of officer access,
// as opposed to a plain 'member'. Mirrors is_tenant_admin() in
// lib/migrations/004_officer_role_tiers.sql — if this list and that SQL
// function's check ever diverge, a route could pass this check and
// still get silently rejected by RLS, or vice versa. Keep them in sync.
const OFFICER_TIERS = new Set<TenantRole>(['admin', 'secretary', 'worshipful_master', 'treasurer', 'warden', 'deacon'])

/**
 * Verifies the current request's user is authenticated AND holds ANY
 * officer-tier role on the given tenant (not specifically which one).
 * Use this for routes/checks where any officer is allowed and the
 * specific tier doesn't matter — e.g. "can view the roster." For
 * routes that should only allow specific tiers (e.g. only Treasurer or
 * Secretary should record a dues payment), use requireTenantRole()
 * below instead, which returns the same shape but narrows the allowed
 * set.
 *
 * A user with NO membership row in this tenant produces
 * `membership === null` — denied by default, not silently passed. See
 * git history / prior comments for the original bug this replaced
 * (a `tenant_role === 'member'` deny-list that let unaffiliated users
 * through). Super admins bypass tenant membership entirely.
 */
export async function requireTenantAdmin(tenantId: string): Promise<AuthResult> {
  return requireTenantRole(tenantId, Array.from(OFFICER_TIERS))
}

/**
 * Like requireTenantAdmin(), but restricts to a specific set of tiers.
 * This is what actually gives different offices different access —
 * requireTenantAdmin() alone treats every officer tier as one
 * undifferentiated bucket, which doesn't distinguish "Treasurer can
 * touch finances" from "a Deacon can too." Pass only the tiers that
 * should legitimately reach a given route.
 *
 * Example: only Secretary/Treasurer/admin should be able to record a
 * dues payment —
 *   const auth = await requireTenantRole(tenantId, ['secretary', 'treasurer', 'admin'])
 */
export async function requireTenantRole(tenantId: string, allowedTiers: TenantRole[]): Promise<AuthResult> {
  if (!tenantId) {
    return { ok: false, response: NextResponse.json({ error: 'Missing tenantId' }, { status: 400 }) }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('platform_role')
    .eq('id', user.id)
    .single()

  // Super admins bypass tier restrictions entirely — this is a platform-
  // level override, not a tenant-level tier, so it isn't subject to
  // allowedTiers the way an in-lodge officer role is.
  if (profile?.platform_role === 'super_admin') {
    return { ok: true, userId: user.id, tenantRole: 'admin' }
  }

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_role, is_active')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .single()

  const allowed = new Set(allowedTiers)

  if (!membership || !membership.is_active || !allowed.has(membership.tenant_role as TenantRole)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id, tenantRole: membership.tenant_role as TenantRole }
}
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
