import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export type SuperAdminAuthResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

/**
 * Verifies the current request's user holds platform_role='super_admin'
 * on their profile. This is a PLATFORM-level permission, entirely
 * separate from tenant_role (which governs access within a single
 * lodge) — a super admin can act across every tenant, which is exactly
 * why this check needs its own function rather than reusing
 * requireTenantAdmin()/requireTenantRole(), both of which are scoped to
 * one tenantId and would reject a request that has no tenant context at
 * all (e.g. "list every lodge on the platform").
 *
 * The super-admin layout (app/super-admin/layout.tsx) already redirects
 * non-super-admins away from every page under /super-admin, but that
 * only protects page RENDERING. API routes underneath /api/super-admin/*
 * are reachable directly regardless of what any page's layout does, so
 * they need this same check applied independently — defense in depth,
 * not redundant.
 */
export async function requireSuperAdmin(): Promise<SuperAdminAuthResult> {
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

  if (profile?.platform_role !== 'super_admin') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden — super admin access required' }, { status: 403 }) }
  }

  return { ok: true, userId: user.id }
}
