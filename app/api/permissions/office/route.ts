import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole } from '@/lib/auth/requireTenantAdmin'
import { loadPositionOverrides } from '@/lib/auth/capabilities'
import { CAPABILITIES, CAPABILITY_META, type Capability } from '@/lib/auth/permissions'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * What a chair carries, whoever is sitting in it.
 *
 * The per-brother editor answers "may Bro. Powell upload a document".
 * This answers "may the Junior Deacon", which is the question a lodge
 * actually votes on — and the one that survives December, when the
 * offices move and the men in them change.
 *
 * WHO MAY SET IT. Admin, secretary or grand master, as a FIXED TIER
 * CHECK. Identical to /api/members/permissions and to
 * can_set_permissions() in the migrations, and fixed for the same
 * reason: a gate that handed out privilege and could itself be widened
 * by that privilege is not a gate. Note especially that an office
 * granted 'settings' does NOT let its holder edit this — otherwise a
 * lodge could give the Tyler's chair the run of the place by accident
 * and have no way back.
 *
 * AN OFFICE THAT SAYS NOTHING IS NOT AN OFFICE THAT SAYS NO. Setting a
 * capability back to "follows the tier" deletes the row rather than
 * writing a value that happens to match today, exactly as in 035. The
 * tiers are the rule; these tables hold only the amendments to it.
 */

export async function PATCH(request: Request) {
  try {
    const { tenantId, lodgeRole, capability, granted } = await request.json()

    if (!tenantId || typeof lodgeRole !== 'string' || !lodgeRole.trim()) {
      return NextResponse.json({ error: 'Missing tenantId or office.' }, { status: 400 })
    }
    if (!CAPABILITIES.includes(capability)) {
      return NextResponse.json({ error: `'${capability}' is not a capability.` }, { status: 400 })
    }

    const auth = await requireTenantRole(tenantId, ['admin', 'secretary', 'grand_master'])
    if (!auth.ok) return auth.response

    const office = lodgeRole.trim()
    const cap = capability as Capability
    const label = CAPABILITY_META[cap].label
    const supabase = createServiceClient()
    const actor = await actorName(auth.userId)

    if (granted === null || granted === undefined) {
      const { error } = await supabase
        .from('position_capabilities')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('lodge_role', office)
        .eq('capability', cap)
      if (error) throw error

      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: actor,
        action: 'office.capability_changed',
        summary: `${label} now follows the tier for the ${office}, rather than being set by the office`,
        entityType: 'lodge_office',
        entityId: null,
        detail: { lodgeRole: office, capability: cap, granted: null },
      })
    } else {
      const { error } = await supabase
        .from('position_capabilities')
        .upsert(
          {
            tenant_id: tenantId,
            lodge_role: office,
            capability: cap,
            granted: Boolean(granted),
            set_by: auth.userId,
            set_by_name: actor,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,lodge_role,capability' }
        )
      if (error) throw error

      await recordAudit({
        tenantId,
        actorId: auth.userId,
        actorName: actor,
        action: 'office.capability_changed',
        summary: granted
          ? `The ${office} may now use ${label}`
          : `The ${office} may no longer use ${label}`,
        entityType: 'lodge_office',
        entityId: null,
        detail: { lodgeRole: office, capability: cap, granted: Boolean(granted) },
      })
    }

    /**
     * WHO THIS JUST AFFECTED, returned so the interface can say so.
     *
     * A permission change nobody can see the consequence of is one
     * officers make blind. "The Junior Deacon may now upload documents"
     * means nothing until you are told that the Junior Deacon is
     * Bro. Powell — and a chair that is empty this year should say that
     * out loud rather than looking like it worked.
     */
    const { data: holders } = await supabase
      .from('tenant_members')
      .select('user_id, profiles(first_name, last_name)')
      .eq('tenant_id', tenantId)
      .eq('lodge_role', office)
      .eq('is_active', true)

    return NextResponse.json({
      success: true,
      office,
      overrides: await loadPositionOverrides(tenantId, office),
      holders: (holders ?? []).map((h: any) =>
        `${h.profiles?.first_name ?? ''} ${h.profiles?.last_name ?? ''}`.trim()
      ).filter(Boolean),
    })
  } catch (error: any) {
    console.error('Set office permissions error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
