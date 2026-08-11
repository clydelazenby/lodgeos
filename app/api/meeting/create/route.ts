import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCapability } from '@/lib/auth/capabilities'
import { openMeetingForEvent } from '@/lib/meeting/openMeeting'

/**
 * Creates a meeting from inside Meeting Mode, optionally opening the
 * lodge on it in the same request.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE EVENTS PAGE
 *
 * Meetings could only be created on the Events page, which is a
 * planning surface — you go there to schedule something upcoming.
 * Meeting Mode is the opposite: it's used at the moment the lodge is
 * convening. An officer who opened it to run tonight's communication
 * and found no matching event had to leave for Events, fill in a
 * scheduling form, come back, and re-select. That's a detour at
 * precisely the moment nobody has attention to spare.
 *
 * THE `openNow` FLAG
 *
 * Creating and opening in one request rather than making the client
 * fire two calls back to back. Two calls would leave a real window
 * where the event exists but is not open — and if the second call
 * failed (say another lodge meeting was already open), the officer
 * would be left with a stray empty event they didn't ask for and
 * probably wouldn't notice.
 *
 * Here, if the open fails, the event that was just created is deleted
 * again before returning the error, so a refused open leaves nothing
 * behind. The event is only kept when it either opened successfully or
 * was never meant to be opened.
 */

const VALID_TYPES = new Set(['degree', 'stated_communication', 'grand_lodge', 'social', 'other'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request: Request) {
  try {
    const { tenantId, title, eventDate, eventTime, eventType, openNow } = await request.json()

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId.' }, { status: 400 })
    }
    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: 'A meeting title is required.' }, { status: 400 })
    }
    if (!eventDate || !ISO_DATE.test(eventDate)) {
      return NextResponse.json({ error: 'A meeting date (YYYY-MM-DD) is required.' }, { status: 400 })
    }
    if (eventType && !VALID_TYPES.has(eventType)) {
      return NextResponse.json({ error: `Unknown meeting type "${eventType}".` }, { status: 400 })
    }

    const auth = await requireCapability(tenantId, 'meetings')
    if (!auth.ok) return auth.response

    const supabase = await createClient()

    const { data: created, error: createError } = await supabase
      .from('lodge_events')
      .insert({
        tenant_id: tenantId,
        title: String(title).trim(),
        event_date: eventDate,
        // An empty time field posts as '' rather than null; Postgres
        // rejects '' for a `time` column, so normalize it here.
        event_time: eventTime ? eventTime : null,
        event_type: eventType || 'stated_communication',
        created_by: auth.userId,
        // Meetings created from Meeting Mode are working records of a
        // communication, not announcements — they must not appear on
        // the public lodge page. The Events page remains the place to
        // create something publicly visible.
        is_public: false,
      })
      .select()
      .single()

    if (createError) throw createError

    if (!openNow) {
      return NextResponse.json({ success: true, event: created, opened: false })
    }

    const opened = await openMeetingForEvent(supabase, tenantId, created.id, auth.userId)

    if (!opened.ok) {
      // Roll back the event so a refused open doesn't leave a stray
      // record behind. Deletion failure is logged but not surfaced —
      // the open error is the one the officer needs to act on, and
      // burying it under a cleanup error would be unhelpful.
      const { error: rollbackError } = await supabase
        .from('lodge_events')
        .delete()
        .eq('id', created.id)
        .eq('tenant_id', tenantId)

      if (rollbackError) {
        console.error('Failed to roll back meeting after open error:', rollbackError)
      }

      return NextResponse.json({ error: opened.error }, { status: opened.status })
    }

    return NextResponse.json({ success: true, event: opened.event, opened: true })
  } catch (error: any) {
    console.error('Create meeting error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
