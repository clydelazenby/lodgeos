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