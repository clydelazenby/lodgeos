import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'

/**
 * Deletes a lodge event.
 *
 * Previously the events page deleted straight from the browser with
 * `supabase.from('lodge_events').delete()`, guarded by a
 * window.confirm(). RLS did enforce that the caller was a tenant admin,
 * so it was not a hole — but it meant the destructive path had no
 * server-side record of what it took with it, and no way to refuse a
 * deletion that would damage the lodge's records.
 *
 * That matters because the schema cascades: deleting an event also
 * deletes its event_rsvps, its meeting_agenda_items, and its
 * `attendance` rows. Attendance is the one that hurts — it feeds the
 * dashboard heatmap, the analytics trends, and the annual return. So a
 * meeting that was actually held and recorded is refused by default and
 * requires an explicit acknowledgement.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const url = new URL(request.url)
    const tenantId = url.searchParams.get('tenantId')
    const force = url.searchParams.get('force') === 'true'

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId.' }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'events')
    if (!auth.ok) return auth.response

    const supabase = createServiceClient()

    const { data: event } = await supabase
      .from('lodge_events')
      .select('id, title')
      .eq('id', params.eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (!event) {
      return NextResponse.json({ error: 'Event not found for this lodge.' }, { status: 404 })
    }

    const { count: attendanceCount } = await supabase
      .from('attendance')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', params.eventId)

    if ((attendanceCount ?? 0) > 0 && !force) {
      return NextResponse.json(
        {
          error:
            `"${event.title}" has attendance recorded for ${attendanceCount} ${attendanceCount === 1 ? 'brother' : 'brothers'}. ` +
            'Deleting it would remove that from the lodge\'s record and change past reports. ' +
            'Clear the attendance first if you really mean to delete this meeting.',
          attendanceCount,
        },
        { status: 409 }
      )
    }

    const { error: deleteError } = await supabase
      .from('lodge_events')
      .delete()
      .eq('id', params.eventId)
      .eq('tenant_id', tenantId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true, deleted: event.title })
  } catch (error: any) {
    console.error('Event delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
