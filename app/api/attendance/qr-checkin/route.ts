import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'

/**
 * Flow 1: an officer scans each member's personal QR at the door.
 * The scanned token identifies WHO (via profiles.qr_token), never
 * WHICH MEETING — the write always targets whichever event is
 * currently open for this tenant. See migration 009's design comment
 * for the full reasoning: this is what makes a screenshotted personal
 * QR harmless to replay at a meeting the member didn't attend — there
 * is no meeting reference baked into the code at all.
 */
export async function POST(request: Request) {
  try {
    const { tenantId, scannedToken } = await request.json()
    if (!scannedToken) return NextResponse.json({ error: 'Missing scannedToken' }, { status: 400 })

    // The scanning officer must be an authorized officer of THIS
    // tenant — same guard as every other attendance-writing route.
    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    // Resolve the token to a real member. Scoped to this tenant via
    // the tenant_members join, so a QR token belonging to a member of
    // a DIFFERENT lodge can't be used to check someone into this one
    // (qr_token is globally unique per profile, but that profile might
    // not even be a member here).
    const { data: membership } = await supabase
      .from('tenant_members')
      .select('user_id, profiles!inner(first_name, last_name, qr_token)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('profiles.qr_token', scannedToken)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'QR code not recognized for this lodge — the member may not be active here.' }, { status: 404 })
    }

    const { data: openEvent } = await supabase
      .from('lodge_events')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .not('opened_at', 'is', null)
      .is('closed_at', null)
      .limit(1)
      .single()

    if (!openEvent) {
      return NextResponse.json({ error: 'No meeting is currently open. Open a meeting from Meeting Mode before scanning members in.' }, { status: 409 })
    }

    const { data: attendance, error } = await supabase
      .from('attendance')
      .upsert(
        { tenant_id: tenantId, event_id: openEvent.id, member_id: membership.user_id, status: 'present' },
        { onConflict: 'event_id,member_id' }
      )
      .select()
      .single()

    if (error) throw error

    const profile = (membership as any).profiles
    return NextResponse.json({
      success: true,
      memberName: `${profile.first_name} ${profile.last_name}`,
      eventTitle: openEvent.title,
      attendance,
    })
  } catch (error: any) {
    console.error('QR check-in error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
