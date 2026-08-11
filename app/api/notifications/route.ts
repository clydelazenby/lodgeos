import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { requireTenantRole } from '@/lib/auth/requireTenantAdmin'
import { NOTIFICATION_EVENTS, notifiedByDefault, type NotificationEvent } from '@/lib/notifications'

/**
 * Who hears when the roster changes.
 *
 * TWO KINDS OF CALLER, and the difference matters:
 *
 * - A man changing HIS OWN. Always allowed, whatever his tier. The only
 *   thing he can do to himself here is receive less email, so there is
 *   nothing to escalate — and a notification he cannot switch off is
 *   one he filters to a folder he never opens, which is worse than not
 *   sending it.
 *
 * - An officer changing SOMEONE ELSE'S. Admin, secretary or grand
 *   master, as a fixed tier check, matching every other page that
 *   decides what another brother gets.
 *
 * A PREFERENCE THAT AGREES WITH THE DEFAULT IS DELETED, not stored —
 * the same rule as the permission tables. The Senior Warden hears
 * because he is the Senior Warden; if he moves chairs next December the
 * notices should move with the chair, and a stored `true` that happened
 * to match today would quietly follow the man instead.
 */
export async function PATCH(request: Request) {
  try {
    const { tenantId, memberId, event, enabled } = await request.json()

    if (!tenantId || !memberId || !event) {
      return NextResponse.json({ error: 'Missing tenantId, memberId or event.' }, { status: 400 })
    }
    if (!NOTIFICATION_EVENTS.includes(event as NotificationEvent)) {
      return NextResponse.json({ error: `'${event}' is not a notification.` }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const editingSelf = user.id === memberId
    if (!editingSelf) {
      const auth = await requireTenantRole(tenantId, ['admin', 'secretary', 'grand_master'])
      if (!auth.ok) return auth.response
    }

    const service = createServiceClient()

    // The target must be on this roster — otherwise a valid profile id
    // from another lodge could have a row written against this tenant.
    const { data: member } = await service
      .from('tenant_members')
      .select('tenant_role, lodge_role, is_active')
      .eq('tenant_id', tenantId)
      .eq('user_id', memberId)
      .maybeSingle()

    if (!member || !(member as any).is_active) {
      return NextResponse.json({ error: 'No such brother on this roster.' }, { status: 404 })
    }

    // A brother editing his own must still be a member of the lodge he
    // names; the check above covers that too.
    const wanted = Boolean(enabled)
    const byDefault = notifiedByDefault(
      event as NotificationEvent,
      (member as any).tenant_role,
      (member as any).lodge_role
    )

    if (wanted === byDefault) {
      const { error } = await service
        .from('notification_preferences')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('member_id', memberId)
        .eq('event_type', event)
      if (error) throw error
    } else {
      const { error } = await service
        .from('notification_preferences')
        .upsert(
          {
            tenant_id: tenantId,
            member_id: memberId,
            event_type: event,
            enabled: wanted,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,member_id,event_type' }
        )
      if (error) throw error
    }

    return NextResponse.json({ success: true, enabled: wanted, followsDefault: wanted === byDefault })
  } catch (error: any) {
    console.error('Notification preference error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
