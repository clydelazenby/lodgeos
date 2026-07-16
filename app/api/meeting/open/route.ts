import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenantAdmin } from '@/lib/auth/requireTenantAdmin'

// Matches the reference image's agenda checklist order exactly:
// Opening, Roll Call of Officers, Reading of Minutes, Treasurer's
// Report, Balloting, Unfinished Business, New Business, Closing.
// Stored as real rows (not a hardcoded enum) so a specific meeting can
// have items added/removed/reordered without a schema change — see
// migration 008's comment on meeting_agenda_items.
const DEFAULT_AGENDA = [
  'Opening', 'Roll Call of Officers', 'Reading of Minutes',
  "Treasurer's Report", 'Balloting', 'Unfinished Business',
  'New Business', 'Closing',
]

export async function POST(request: Request) {
  try {
    const { tenantId, eventId } = await request.json()
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

    const auth = await requireTenantAdmin(tenantId)
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { data: event } = await supabase.from('lodge_events').select('*').eq('id', eventId).eq('tenant_id', tenantId).single()
    if (!event) return NextResponse.json({ error: 'Event not found for this lodge' }, { status: 404 })
    if (event.opened_at && !event.closed_at) {
      return NextResponse.json({ error: 'This meeting is already open' }, { status: 409 })
    }

    // Only one meeting should be open at a time per lodge — check for
    // any other event with opened_at set and closed_at null, and
    // refuse rather than silently allow two "live" meetings, which
    // would make the dashboard/nav's "current meeting" concept ambiguous.
    const { data: otherOpen } = await supabase
      .from('lodge_events')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .not('opened_at', 'is', null)
      .is('closed_at', null)
      .neq('id', eventId)
      .limit(1)
      .single()

    if (otherOpen) {
      return NextResponse.json({ error: `"${otherOpen.title}" is already open. Close it before opening another meeting.` }, { status: 409 })
    }

    const { data: updated, error: updateError } = await supabase
      .from('lodge_events')
      .update({ opened_at: new Date().toISOString(), closed_at: null, opened_by: auth.userId, meeting_qr_token: crypto.randomUUID() })
      .eq('id', eventId)
      .select()
      .single()

    if (updateError) throw updateError

    // Seed the agenda only if this event has no items yet — re-opening
    // a meeting that was previously opened (and maybe closed by
    // mistake) should not duplicate its checklist.
    const { count: existingCount } = await supabase.from('meeting_agenda_items').select('*', { count: 'exact', head: true }).eq('event_id', eventId)
    if (!existingCount) {
      const rows = DEFAULT_AGENDA.map((label, i) => ({ event_id: eventId, tenant_id: tenantId, label, sort_order: i }))
      const { error: seedError } = await supabase.from('meeting_agenda_items').insert(rows)
      if (seedError) throw seedError
    }

    return NextResponse.json({ success: true, event: updated })
  } catch (error: any) {
    console.error('Open meeting error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
