import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { canEditDuties, defaultDuties } from '@/lib/duties'
import { recordAudit, actorName } from '@/lib/audit'

/**
 * What a lodge says one of its offices is responsible for.
 *
 * THE GUARD IS NOT A CAPABILITY. Every other write in this app hangs
 * off requireCapability, and this one deliberately does not: the
 * lodge asked for the administrative tier plus the Master's and Senior
 * Warden's CHAIRS, and a chair is not a capability — no tenant_role
 * can express "the man in the West". It is checked here against the
 * membership row, and backed by can_edit_duties() in migration 041.
 *
 * SAVING EMPTY IS A RESET, NOT AN EDIT. Clearing the box deletes the
 * row and the shipped default applies again. Writing the default into
 * the table instead would freeze today's wording as though the lodge
 * had chosen it, and the lodge would stop receiving corrections to
 * text it never wrote.
 */
/**
 * One office's duties, for the modal behind the office name in a
 * greeting.
 *
 * READ BY ANY ACTIVE BROTHER OF THE LODGE, which is the whole point of
 * the feature — including the plain member tier, who cannot open the
 * lodge-side page at all. Nothing here is privileged: it is a
 * description of a chair, and the lodge's own roll of who sits in it.
 *
 * Fetched on OPEN rather than shipped with every page that shows an
 * office name. The greeting appears on two dashboards and a profile
 * header; sending several paragraphs of prose with each of them, on
 * the chance somebody taps it, is a cost paid by everyone for the few
 * who do.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenantId') ?? ''
    const office = (url.searchParams.get('office') ?? '').trim()

    if (!tenantId || !office) {
      return NextResponse.json({ error: 'Missing tenantId or office.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    const { data: membership } = await service
      .from('tenant_members')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    const { data: profile } = await service
      .from('profiles').select('platform_role').eq('id', user.id).maybeSingle()

    if (!membership && (profile as any)?.platform_role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [{ data: written }, { data: holderRows }] = await Promise.all([
      service
        .from('office_duties')
        .select('duties, updated_by_name')
        .eq('tenant_id', tenantId)
        .eq('lodge_role', office)
        .maybeSingle(),
      service
        .from('tenant_members')
        .select('profiles(first_name, last_name)')
        .eq('tenant_id', tenantId)
        .eq('lodge_role', office)
        .eq('is_active', true),
    ])

    const custom = (written as any)?.duties ?? null

    return NextResponse.json({
      office,
      duties: custom ?? defaultDuties(office),
      // So the modal can say whose words these are — the lodge's, or a
      // general description it has not approved.
      custom: !!custom,
      updatedByName: (written as any)?.updated_by_name ?? null,
      holders: (holderRows ?? [])
        .map((h: any) => `${h.profiles?.first_name ?? ''} ${h.profiles?.last_name ?? ''}`.trim())
        .filter(Boolean),
    })
  } catch (error: any) {
    console.error('Duties read error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { tenantId, lodgeRole, duties } = await request.json()

    if (!tenantId || typeof lodgeRole !== 'string' || !lodgeRole.trim()) {
      return NextResponse.json({ error: 'Missing tenantId or office.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = createServiceClient()

    const [{ data: profile }, { data: membership }] = await Promise.all([
      service.from('profiles').select('platform_role').eq('id', user.id).maybeSingle(),
      service
        .from('tenant_members')
        .select('tenant_role, lodge_role, is_active')
        .eq('tenant_id', tenantId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    const isSuperAdmin = (profile as any)?.platform_role === 'super_admin'
    const active = !!membership && (membership as any).is_active

    if (!isSuperAdmin && !active) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!canEditDuties((membership as any)?.tenant_role, (membership as any)?.lodge_role, isSuperAdmin)) {
      return NextResponse.json(
        { error: 'Only an admin, the Worshipful Master or the Senior Warden may change the duties.' },
        { status: 403 }
      )
    }

    const office = lodgeRole.trim()
    const text = typeof duties === 'string' ? duties.trim() : ''
    const actor = await actorName(user.id)

    if (!text) {
      const { error } = await service
        .from('office_duties')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('lodge_role', office)
      if (error) throw error

      await recordAudit({
        tenantId,
        actorId: user.id,
        actorName: actor,
        action: 'duties.reset',
        summary: `Reset the ${office}'s duties to the standard description`,
        entityType: 'lodge_office',
        entityId: null,
        detail: { lodgeRole: office },
      })

      return NextResponse.json({ success: true, duties: defaultDuties(office), custom: false })
    }

    // 8000 characters is several pages — long enough for a lodge that
    // wants to transcribe its bylaws, short enough that a paste
    // accident cannot fill the table.
    const trimmed = text.slice(0, 8000)

    const { error } = await service
      .from('office_duties')
      .upsert(
        {
          tenant_id: tenantId,
          lodge_role: office,
          duties: trimmed,
          updated_by: user.id,
          updated_by_name: actor,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,lodge_role' }
      )
    if (error) throw error

    await recordAudit({
      tenantId,
      actorId: user.id,
      actorName: actor,
      action: 'duties.updated',
      summary: `Rewrote the ${office}'s duties`,
      entityType: 'lodge_office',
      entityId: null,
      detail: { lodgeRole: office, length: trimmed.length },
    })

    return NextResponse.json({ success: true, duties: trimmed, custom: true })
  } catch (error: any) {
    console.error('Duties error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
