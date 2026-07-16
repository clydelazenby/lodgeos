import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * Flow 2: a single QR is displayed for the meeting (e.g. on a screen
 * at the door or the Secretary's laptop); members scan it with their
 * own phones to check themselves in.
 *
 * Deliberately does NOT use requireTenantAdmin() — that guard is for
 * OFFICER actions, and self-checkin is a regular member action. This
 * route has its own, narrower authorization: the scanning user must
 * be logged in (so the write is attributed to a real person, not
 * anonymous) and must be an ACTIVE member of the tenant that meeting
 * belongs to. That's a genuinely different permission shape than every
 * other route tonight, not a relaxed version of the same one.
 */
export async function POST(request: Request) {
  try {
    const { scannedMeetingToken } = await request.json()
    if (!scannedMeetingToken) return NextResponse.json({ error: 'Missing scannedMeetingToken' }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in to check yourself in.' }, { status: 401 })

    // Resolve the meeting token to a real, CURRENTLY open event. Scoped
    // to opened_at set / closed_at null as well as the token match, so
    // a token from a meeting that has since closed (meeting_qr_token is
    // nulled on close, per migration 009) genuinely cannot match anything.
    const { data: event } = await supabase
      .from('lodge_events')
      .select('id, tenant_id, title')
      .eq('meeting_qr_token', scannedMeetingToken)
      .not('opened_at', 'is', null)
      .is('closed_at', null)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'This QR code is not valid for any meeting currently in progress.' }, { status: 404 })
    }

    // Confirm the scanning user is genuinely an active member of THIS
    // event's tenant — without this, anyone with an account on the
    // platform (a member of a different lodge) could self-checkin to a
    // meeting they have no real connection to.
    const { data: membership } = await supabase
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', event.tenant_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'You are not an active member of this lodge.' }, { status: 403 })
    }

    // Service client for the write itself: a plain member's own
    // session would FAIL the existing "Attendance manageable by
    // admins" RLS policy (is_tenant_admin(tenant_id)), since a regular
    // member is not an officer. The real authorization for this write
    // already happened above — a genuine logged-in user, confirmed
    // active membership in this exact tenant, confirmed the meeting is
    // actually open and the token matches — so bypassing RLS here with
    // the service role is correct, not a shortcut around a check that
    // still needs to happen.
    const serviceClient = await createServiceClient()
    const { data: attendance, error } = await serviceClient
      .from('attendance')
      .upsert(
        { tenant_id: event.tenant_id, event_id: event.id, member_id: user.id, status: 'present' },
        { onConflict: 'event_id,member_id' }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, eventTitle: event.title, attendance })
  } catch (error: any) {
    console.error('QR self-checkin error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
