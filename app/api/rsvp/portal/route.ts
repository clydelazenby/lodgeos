import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * A brother answering an invitation from inside the portal.
 *
 * The existing RSVP path (/api/rsvp/[token]) is for the one-tap links
 * in invitation emails: anonymous, authorised purely by an unguessable
 * token. That is the right shape for a link in an inbox and the wrong
 * shape here — a brother reading his own events page is already signed
 * in, and asking him to dig out an email to answer would be absurd.
 *
 * So this route has its own, narrower authorization, matching the shape
 * qr-self-checkin uses: the caller must be signed in, and must be an
 * ACTIVE member of the tenant the event belongs to. It writes only the
 * caller's OWN row — user_id comes from the session, never from the
 * request body, so nobody can answer on another brother's behalf.
 *
 * The service client does the write because migration 003 deliberately
 * added no insert/update policy to event_rsvps; the real authorization
 * has already happened above.
 */

const VALID = new Set(['yes', 'no', 'maybe'])

export async function POST(request: Request) {
  try {
    const { eventId, response } = await request.json().catch(() => ({}))

    if (!eventId || !VALID.has(response)) {
      return NextResponse.json({ error: 'An event and a response of yes, no or maybe are required.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in to answer.' }, { status: 401 })

    const { data: event } = await supabase
      .from('lodge_events')
      .select('id, tenant_id, title')
      .eq('id', eventId)
      .maybeSingle()

    if (!event) return NextResponse.json({ error: 'That event no longer exists.' }, { status: 404 })

    const { data: membership } = await supabase
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', (event as any).tenant_id)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'You are not an active member of this lodge.' }, { status: 403 })
    }

    const service = createServiceClient()
    const { error } = await service
      .from('event_rsvps')
      .upsert(
        { event_id: eventId, user_id: user.id, response, responded_at: new Date().toISOString() },
        { onConflict: 'event_id,user_id' }
      )

    if (error) throw error

    return NextResponse.json({ success: true, response })
  } catch (error: any) {
    console.error('Portal RSVP error:', error)
    return NextResponse.json({ error: error?.message || 'Your answer could not be saved.' }, { status: 500 })
  }
}
