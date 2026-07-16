import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'
import { sendEventInviteEmail } from '@/lib/email'
import { buildIcsEvent, icsUidForEvent, eventTimesFromRow } from '@/lib/ics'
import { format } from 'date-fns'

export async function POST(request: Request) {
  try {
    const { tenantId, eventId } = await request.json()
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    const { data: event } = await supabase.from('lodge_events').select('*').eq('id', eventId).eq('tenant_id', tenantId).single()
    if (!event) return NextResponse.json({ error: 'Event not found for this lodge' }, { status: 404 })

    const { data: tenant } = await supabase.from('tenants').select('name, number').eq('id', tenantId).single()
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

    const { data: sender } = await supabase.from('profiles').select('first_name, last_name, email').eq('id', auth.userId).single()

    const { data: members } = await supabase
      .from('tenant_members')
      .select('user_id, profiles(first_name, email)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    const { start, end } = eventTimesFromRow(event.event_date, event.event_time)
    const uid = icsUidForEvent(event.id)
    const lodgeName = `${tenant.name} #${tenant.number}`
    const dateLabel = `${format(start, 'EEEE, MMMM d, yyyy')} · ${format(start, 'h:mm a')}`

    let sent = 0
    let failed = 0

    for (const m of members ?? []) {
      const profile = (m as any).profiles
      if (!profile?.email) { failed++; continue }

      // Upsert rather than insert: re-sending invites for the same event
      // reuses the existing token instead of orphaning the one already
      // emailed out, and leaves any prior response untouched.
      const { data: rsvpRow } = await supabase
        .from('event_rsvps')
        .upsert(
          { event_id: event.id, user_id: m.user_id, response: 'maybe' },
          { onConflict: 'event_id,user_id', ignoreDuplicates: true }
        )
        .select('rsvp_token')
        .single()

      const token = rsvpRow?.rsvp_token ?? (
        await supabase.from('event_rsvps').select('rsvp_token').eq('event_id', event.id).eq('user_id', m.user_id).single()
      ).data?.rsvp_token

      if (!token) { failed++; continue }

      try {
        const ics = buildIcsEvent({
          uid, sequence: 0,
          title: event.title,
          description: event.description || undefined,
          location: event.location || undefined,
          startUtc: start,
          endUtc: end,
          organizerEmail: sender?.email || process.env.EMAIL_FROM || 'noreply@lodgeos.com',
          organizerName: sender ? `${sender.first_name} ${sender.last_name}`.trim() : lodgeName,
          attendeeEmail: profile.email,
          attendeeName: profile.first_name ?? 'Brother',
        })

        await sendEventInviteEmail({
          to: profile.email,
          firstName: profile.first_name ?? 'Brother',
          lodgeName,
          eventTitle: event.title,
          eventDateLabel: dateLabel,
          location: event.location,
          description: event.description,
          icsContent: ics,
          rsvpToken: token,
        })
        sent++
      } catch {
        failed++
      }
    }

    return NextResponse.json({ success: sent > 0, sent, failed, total: members?.length ?? 0 })
  } catch (error: any) {
    console.error('Send event invites error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
