import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { AuthResult, TenantRole } from '@/lib/auth/requireTenantAdmin'
import { can, grantedTiers, type Capability, type CapabilityOverrides } from '@/lib/auth/permissions'

/**
 * THE BOUNDARY.
 *
 * lib/auth/permissions.ts decides what the interface OFFERS. This file
 * decides what the server ALLOWS, and it is the only one of the two
 * that matters. Everything below reads real rows — the profile, the
 * membership, the exceptions — and nothing is inferred from a cookie or
 * from anything the caller sent.
 *
 * WHY THIS EXISTS AT ALL. Before per-brother permissions, a route guard
 * was a list of tiers and requireTenantRole() checked membership against
 * it. That is still true underneath; what changes is that a brother's
 * own exceptions (migration 035) are consulted first, so a Deacon
 * granted 'documents' is genuinely allowed to upload rather than merely
 * shown the button.
 *
 * A PERMISSION THE INTERFACE OFFERS AND THE SERVER REFUSES IS WORSE
 * THAN NO PERMISSION AT ALL — the officer believes he has delegated
 * something, the brother believes he has been trusted with it, and the
 * failure only surfaces at the last step in front of both of them. That
 * is the whole reason this file was written alongside the editor rather
 * than after it.
 */

/**
 * One brother's exceptions. Service client on purpose: this runs inside
 * guards that must not depend on the caller's own RLS visibility, and
 * the tenant/member pair is fixed by the caller, never by the request
 * body.
 */
export async function loadOverrides(
  tenantId: string,
  memberId: string
): Promise<CapabilityOverrides> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('member_capabilities')
    .select('capability, granted')
    .eq('tenant_id', tenantId)
    .eq('member_id', memberId)

  const overrides: CapabilityOverrides = {}
  for (const row of data ?? []) {
    overrides[(row as any).capability as Capability] = (row as any).granted
  }
  return overrides
}

/**
 * Guard for a route that a capability governs.
 *
 * @param allowedTiers the tiers this route accepts, when they differ
 *        from the capability's default grant. A few routes are
 *        deliberately wider than the nav is — /api/members/invite has
 *        always let the Worshipful Master invite a brother, while the
 *        'roster' capability that lights up the Roster nav does not
 *        include him. Passing the route's own list keeps every existing
 *        answer identical and confines this change to the exceptions.
 *
 * The exception layer applies either way: granted=true admits a man no
 * tier list would, granted=false refuses one every tier list would.
 */
export async function requireCapability(
  tenantId: string,
  capability: Capability,
  allowedTiers?: TenantRole[]
): Promise<AuthResult> {
  if (!tenantId) {
    return { ok: false, response: NextResponse.json({ error: 'Missing tenantId' }, { status: 400 }) }
  }

  const supabase = await createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Identity only, never privilege — same rule as requireTenantRole,
  // and read the note there before touching this.
  const cookieStore = await cookies()
  const userId = user?.id || cookieStore.get('lodgeos_user_id')?.value

  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

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

  // An inactive brother has no capabilities at all, and no exception
  // reinstates him. Being off the roster is a different question from
  // what he was allowed to do while on it, and it outranks it — the
  // alternative is a removed member who kept 'finance' still being able
  // to levy charges.
  if (!membership || !membership.is_active) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const role = membership.tenant_role as TenantRole
  const overrides = await loadOverrides(tenantId, userId)
  const exception = overrides[capability]

  const permitted =
    exception !== undefined
      ? exception
      : (allowedTiers ?? grantedTiers(capability)).includes(role)

  if (!permitted) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { ok: true, userId, tenantRole: role }
}

/**
 * What a viewer may do, for a Server Component deciding what to render.
 *
 * Returns the tier, the super-admin flag and the exceptions together,
 * because a page that reads two of the three and forgets the last one
 * is exactly the drift this file exists to prevent. Pass the result
 * straight into can().
 */
export async function viewerCapabilities(
  tenantId: string,
  userId: string | null | undefined,
  role: TenantRole | null | undefined,
  isSuperAdmin: boolean
): Promise<{
  role: TenantRole | null
  isSuperAdmin: boolean
  overrides: CapabilityOverrides
  allow: (c: Capability) => boolean
}> {
  const overrides = userId && !isSuperAdmin ? await loadOverrides(tenantId, userId) : {}
  return {
    role: role ?? null,
    isSuperAdmin,
    overrides,
    allow: (c: Capability) => can(role ?? null, c, isSuperAdmin, overrides),
  }
}
