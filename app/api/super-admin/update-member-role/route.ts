import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuperAdmin } from '@/lib/auth/requireSuperAdmin'

// Matches lib/migrations/004_officer_role_tiers.sql's check constraint.
const VALID_TIERS = new Set(['secretary', 'worshipful_master', 'treasurer', 'warden', 'deacon', 'admin', 'member'])

/**
 * Directly reassigns an existing tenant_members row's tenant_role
 * and/or lodge_role — for correcting a role after the fact, not just
 * at invite time (app/api/members/invite/route.ts only sets role once,
 * on creation). A super admin can do this across ANY tenant, which is
 * the whole reason this exists as its own route rather than reusing
 * requireTenantRole() (that's scoped to acting within one tenant as an
 * officer OF that tenant, not acting on any tenant from the platform
 * level).
 */
export async function POST(request: Request) {
  try {
    const { membershipId, tenantRole, lodgeRole, isActive } = await request.json()
    if (!membershipId) {
      return NextResponse.json({ error: 'Missing membershipId' }, { status: 400 })
    }
    if (tenantRole !== undefined && !VALID_TIERS.has(tenantRole)) {
      return NextResponse.json({ error: `Invalid tenantRole: ${tenantRole}` }, { status: 400 })
    }

    const auth = await requireSuperAdmin()
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const updates: Record<string, unknown> = {}
    if (tenantRole !== undefined) updates.tenant_role = tenantRole
    if (lodgeRole !== undefined) updates.lodge_role = lodgeRole
    if (isActive !== undefined) updates.is_active = isActive

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('tenant_members')
      .update(updates)
      .eq('id', membershipId)
      .select('*, profiles(first_name, last_name, email)')
      .single()

    if (error) throw error
    if (!updated) return NextResponse.json({ error: 'Membership not found' }, { status: 404 })

    return NextResponse.json({ success: true, membership: updated })
  } catch (error: any) {
    console.error('Super admin update member role error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
