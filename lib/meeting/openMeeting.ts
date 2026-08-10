import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Opening the lodge on a given event.
 *
 * Extracted from app/api/meeting/open/route.ts so that route and
 * /api/meeting/create can share it. The rule this enforces — at most
 * one meeting open per lodge at a time — is an invariant, not a
 * formality: the dashboard, the QR self-check-in route, and Meeting
 * Mode's auto-select all assume "the open meeting" is a single
 * unambiguous thing. Two copies of that check would eventually drift,
 * and the drift would only surface as a lodge with two live meetings.
 */

// Matches the reference image's agenda checklist order exactly:
// Opening, Roll Call of Officers, Reading of Minutes, Treasurer's
// Report, Balloting, Unfinished Business, New Business, Closing.
// Stored as real rows (not a hardcoded enum) so a specific meeting can
// have items added/removed/reordered without a schema change — see
// migration 008's comment on meeting_agenda_items.
export const DEFAULT_AGENDA = [
  'Opening', 'Roll Call of Officers', 'Reading of Minutes',
  "Treasurer's Report", 'Balloting', 'Unfinished Business',
  'New Business', 'Closing',
]

export type OpenResult =
  | { ok: true; event: any }
  | { ok: false; error: string; status: number }

export async function openMeetingForEvent(
  supabase: SupabaseClient,
  tenantId: string,
  eventId: string,
  userId: string
): Promise<OpenResult> {
  const { data: event } = await supabase
    .from('lodge_events')
    .select('*')
    .eq('id', eventId)
    .eq('tenant_id', tenantId)
    .single()

  if (!event) {
    return { ok: false, error: 'Event not found for this lodge', status: 404 }
  }

  if (event.opened_at && !event.closed_at) {
    return { ok: false, error: 'This meeting is already open', status: 409 }
  }

  // Refuse rather than silently allow two "live" meetings, which would
  // make the "current meeting" concept ambiguous everywhere it's used.
  const { data: otherOpen } = await supabase
    .from('lodge_events')
    .select('id, title')
    .eq('tenant_id', tenantId)
    .not('opened_at', 'is', null)
    .is('closed_at', null)
    .neq('id', eventId)
    .limit(1)
    .maybeSingle()

  if (otherOpen) {
    return {
      ok: false,
      error: `"${otherOpen.title}" is already open. Close it before opening another meeting.`,
      status: 409,
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('lodge_events')
    .update({
      opened_at: new Date().toISOString(),
      closed_at: null,
      opened_by: userId,
      meeting_qr_token: crypto.randomUUID(),
    })
    .eq('id', eventId)
    .select()
    .single()

  if (updateError) {
    return { ok: false, error: updateError.message, status: 500 }
  }

  // Seed the agenda only if this event has no items yet — re-opening a
  // meeting that was previously closed by mistake should not duplicate
  // its checklist.
  const { count: existingCount } = await supabase
    .from('meeting_agenda_items')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (!existingCount) {
    const rows = DEFAULT_AGENDA.map((label, i) => ({
      event_id: eventId,
      tenant_id: tenantId,
      label,
      sort_order: i,
    }))
    const { error: seedError } = await supabase.from('meeting_agenda_items').insert(rows)
    if (seedError) {
      return { ok: false, error: seedError.message, status: 500 }
    }
  }

  return { ok: true, event: updated }
}
