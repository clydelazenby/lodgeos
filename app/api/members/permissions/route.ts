import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole, type TenantRole } from '@/lib/auth/requireTenantAdmin'
import { requireCapability, loadOverrides } from '@/lib/auth/capabilities'
import { CAPABILITIES, CAPABILITY_META, roleLabel, tierGrants, type Capability } from '@/lib/auth/permissions'
import { DEGREE_VALUES, degreeLabel } from '@/lib/degrees'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * What one brother may do, set on his own profile.
 *
 * Three separate changes live here because they are the three answers
 * to "what is this man allowed to do", and an officer setting them
 * thinks of them together:
 *
 *   tenantRole   his tier — the rule
 *   capability   an exception to it, either way (migration 035)
 *   degree       how far he has come, which some work requires
 *
 * WHO MAY SET THEM
 *
 * Tier and exceptions: admin, secretary or grand master, checked as a
 * FIXED TIER LIST rather than through requireCapability('settings').
 * That is deliberate and it matches can_set_permissions() in the
 * migration: if the gate on this table consulted this table, a granted
 * 'settings' exception would let a man widen the very gate that issued
 * it, and from there grant himself everything else. The one permission
 * that hands out permissions stays on the tier.
 *
 * Degree: the 'roster' capability — register work, the Secretary's
 * book, and now genuinely delegable to whoever actually keeps it.
 *
 * GUARDS
 *
 * - NOBODY EDITS HIS OWN. Not because a Secretary could gain anything —
 *   his tier already holds every capability — but because the one thing
 *   he can do to himself is take something away, and a lodge whose only
 *   administrator has revoked his own 'settings' has nobody left who
 *   can give it back. Ask another officer; there is always one.
 * - The last admin-tier officer cannot be moved off that tier, for the
 *   same reason /api/members/remove will not remove him.
 * - An exception is only stored when it DISAGREES with the tier.
 *   Choosing "follow his tier" deletes the row rather than writing a
 *   value that happens to match today — tiers change, and an exception
 *   that silently became a rule is one nobody meant to make.
 */

const ADMIN_TIER_ROLES = new Set<TenantRole>(['admin', 'secretary', 'grand_master'])

const ASSIGNABLE_ROLES: TenantRole[] = [
  'admin', 'secretary', 'grand_master', 'worshipful_master',
  'treasurer', 'warden', 'deacon', 'member',
]

async function targetMember(tenantId: string, memberId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('tenant_members')
    .select('id, tenant_role, degree, is_active, profiles(first_name, last_name)')
    .eq('tenant_id', tenantId)
    .eq('user_id', memberId)
    .maybeSingle()
  return data as any
}

function nameOf(member: any): string {
  const p = member?.profiles
  return `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'a brother'
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { tenantId, memberId } = body

    if (!tenantId || !memberId) {
      return NextResponse.json({ error: 'Missing tenantId or memberId.' }, { status: 400 })
    }

    const wantsDegree = typeof body.degree === 'string'
    const wantsRole = typeof body.tenantRole === 'string'
    const wantsCapability = typeof body.capability === 'string'

    if (!wantsDegree && !wantsRole && !wantsCapability) {
      return NextResponse.json(
        { error: 'Nothing to change — send a degree, a tenantRole or a capability.' },
        { status: 400 }
      )
    }

    // One change per call. Permission changes are audited one line each
    // and read back one line each; batching them would collapse "made
    // him Treasurer" and "took away his notices" into a single entry
    // that describes neither.
    if ([wantsDegree, wantsRole, wantsCapability].filter(Boolean).length > 1) {
      return NextResponse.json(
        { error: 'Change one thing at a time.' },
        { status: 400 }
      )
    }

    const auth = wantsDegree
      ? await requireCapability(tenantId, 'roster')
      : await requireTenantRole(tenantId, ['admin', 'secretary', 'grand_master'])
    if (!auth.ok) return auth.response

    const member = await targetMember(tenantId, memberId)
    if (!member) {
      return NextResponse.json({ error: 'No such brother on this roster.' }, { status: 404 })
    }
    if (!member.is_active) {
      return NextResponse.json(
        { error: 'He is not on the roster. Reinstate him first.' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const who = nameOf(member)
    const actor = await actorName(auth.userId)

    // ------------------------------------------------------------
    // Degree
    // ------------------------------------------------------------
    if (wantsDegree) {
      const degree = body.degree as string
      if (!DEGREE_VALUES.includes(degree)) {
        return NextResponse.json({ error: `'${degree}' is not a degree this app knows.` }, { status: 400 })
      }
      if (degree === member.degree) return NextResponse.json({ success: true, degree })

      const { error } = await supabase
        .from('tenant_members')
        .update({ degree })
        .eq('tenant_id', tenantId)
        .eq('user_id', memberId)
      if (error) throw error

      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: actor,
        action: 'member.degree_changed',
        summary: `Recorded ${who} as ${degreeLabel(degree)} (was ${degreeLabel(member.degree)})`,
        entityType: 'tenant_member',
        entityId: member.id,
        detail: { from: member.degree, to: degree },
      })

      return NextResponse.json({ success: true, degree })
    }

    // Everything below changes what he is ALLOWED to do, and the two
    // guards that only apply to that live here rather than being
    // repeated in each branch.
    const isSuperAdmin = auth.tenantRole === 'admin' && !(await isRealMember(tenantId, auth.userId))
    if (auth.userId === memberId && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'You cannot change your own permissions. Ask another officer to do it.' },
        { status: 403 }
      )
    }

    // ------------------------------------------------------------
    // Tier
    // ------------------------------------------------------------
    if (wantsRole) {
      const tenantRole = body.tenantRole as TenantRole
      if (!ASSIGNABLE_ROLES.includes(tenantRole)) {
        return NextResponse.json({ error: `'${tenantRole}' is not a permission tier.` }, { status: 400 })
      }
      if (tenantRole === member.tenant_role) return NextResponse.json({ success: true, tenantRole })

      // The lodge must never be left without an administrative officer.
      // Same rule, same reason, as /api/members/remove — a lodge that
      // demotes its last admin needs super-admin help to undo it.
      if (ADMIN_TIER_ROLES.has(member.tenant_role) && !ADMIN_TIER_ROLES.has(tenantRole)) {
        const { count } = await supabase
          .from('tenant_members')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .in('tenant_role', Array.from(ADMIN_TIER_ROLES))

        if ((count ?? 0) <= 1) {
          return NextResponse.json(
            { error: `${who} is the lodge's only Secretary-tier officer. Give someone else that tier first, or the lodge will have nobody who can administer it.` },
            { status: 400 }
          )
        }
      }

      const { error } = await supabase
        .from('tenant_members')
        .update({ tenant_role: tenantRole })
        .eq('tenant_id', tenantId)
        .eq('user_id', memberId)
      if (error) throw error

      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: actor,
        action: 'member.role_changed',
        summary: `Changed ${who}'s permission tier from ${roleLabel(member.tenant_role)} to ${roleLabel(tenantRole)}`,
        entityType: 'tenant_member',
        entityId: member.id,
        detail: { from: member.tenant_role, to: tenantRole },
      })

      return NextResponse.json({ success: true, tenantRole })
    }

    // ------------------------------------------------------------
    // One capability, as an exception to his tier
    // ------------------------------------------------------------
    const capability = body.capability as Capability
    if (!CAPABILITIES.includes(capability)) {
      return NextResponse.json({ error: `'${capability}' is not a capability.` }, { status: 400 })
    }

    // null/undefined means "follow his tier" — the exception is removed.
    const granted: boolean | null =
      body.granted === null || body.granted === undefined ? null : Boolean(body.granted)

    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null
    const byTier = tierGrants(member.tenant_role as TenantRole, capability)
    const label = CAPABILITY_META[capability].label

    if (granted === null || granted === byTier) {
      // Nothing to overrule. See the header: an exception that agrees
      // with the tier is not stored, so that changing his tier later
      // moves this with it instead of leaving a rule nobody set.
      const { error } = await supabase
        .from('member_capabilities')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('member_id', memberId)
        .eq('capability', capability)
      if (error) throw error

      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: actor,
        action: 'member.capability_changed',
        summary: `${who}'s access to ${label} now follows his tier (${roleLabel(member.tenant_role)}: ${byTier ? 'allowed' : 'not allowed'})`,
        entityType: 'tenant_member',
        entityId: member.id,
        detail: { capability, granted: null, tierDefault: byTier },
      })
    } else {
      const { error } = await supabase
        .from('member_capabilities')
        .upsert(
          {
            tenant_id: tenantId,
            member_id: memberId,
            capability,
            granted,
            set_by: auth.userId,
            set_by_name: actor,
            note,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,member_id,capability' }
        )
      if (error) throw error

      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: actor,
        action: 'member.capability_changed',
        summary: granted
          ? `Gave ${who} access to ${label}, which his tier (${roleLabel(member.tenant_role)}) does not include`
          : `Took away ${who}'s access to ${label}, which his tier (${roleLabel(member.tenant_role)}) would otherwise allow`,
        entityType: 'tenant_member',
        entityId: member.id,
        detail: { capability, granted, tierDefault: byTier, note },
      })
    }

    return NextResponse.json({
      success: true,
      overrides: await loadOverrides(tenantId, memberId),
    })
  } catch (error: any) {
    console.error('Set permissions error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Whether the caller is really on this roster, as opposed to a platform
 * super admin whom requireTenantRole reports as 'admin' without one.
 *
 * Used only to let a super admin past the no-editing-your-own-
 * permissions guard: he has no membership row to edit, so the guard
 * cannot be protecting him from anything, and he is the man a
 * locked-out lodge calls.
 */
async function isRealMember(tenantId: string, userId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('tenant_members')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}
