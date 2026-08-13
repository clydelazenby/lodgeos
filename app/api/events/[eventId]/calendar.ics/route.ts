import { createServiceClient } from '@/lib/supabase/server'
import { icsUidForEvent } from '@/lib/ics'

/**
 * Serves a lodge event as a downloadable .ics calendar file.
 *
 * WHY A LINK RATHER THAN AN ATTACHMENT
 *
 * Resend's batch endpoint cannot carry attachments — its own type is
 * Omit<CreateEmailOptions, 'attachments'> — so a batched lodge notice
 * physically cannot include an .ics file. Sending individually to
 * attach one would mean one HTTP request per brother, reintroducing the
 * timeout and rate-limit problems batching exists to solve.
 *
 * A link is arguably better anyway: mail-security filters strip or
 * quarantine calendar attachments far more often than links, and on a
 * phone tapping a link opens the calendar app directly rather than
 * going through a download step.
 *
 * ACCESS
 *
 * No session — this is opened from an email client, which carries no
 * cookies. The event id is a random UUID and is not enumerable, and the
 * file contains only what the notice email already stated in plain
 * text: title, date, location. It deliberately does NOT include the
 * attendee list, the description of any private business, or anything
 * not already in the email the brother is holding.
 *
 * THAT LAST SENTENCE WAS NOT TRUE UNTIL NOW. The query selected
 * `description` and the file emitted it, for every event, public or
 * not — so anyone holding the link to a private stated communication
 * got whatever business had been written into it, with no session and
 * no membership. An event id is not guessable, but it is not a secret
 * either: it sits in the URL of the event page an officer might paste
 * to a brother, and this very link travels inside emails that get
 * forwarded.
 *
 * A private event now describes itself as the lodge's own name, which
 * is what a calendar entry needs and all an outsider should get. The
 * brother reading it already has the description in the email the link
 * came in.
 *
 * METHOD:PUBLISH, not REQUEST — this is "add this to your calendar",
 * not a per-attendee invitation with RSVP tracking. RSVP lives on the
 * event invite emails, which are addressed individually and carry the
 * one-tap links.
 */
export async function GET(
  _request: Request,
  { params }: { params: { eventId: string } }
) {
  const supabase = createServiceClient()

  const { data: event } = await supabase
    .from('lodge_events')
    .select('id, title, event_date, event_time, location, description, is_public, tenant_id, tenants(name, number)')
    .eq('id', params.eventId)
    .maybeSingle()

  if (!event) {
    return new Response('Event not found', { status: 404 })
  }

  // event_time is a bare `time` column with no zone. Treating it as UTC
  // would shift a 7pm meeting to 2pm for a US lodge, so it is emitted as
  // FLOATING local time (no Z suffix) — the iCalendar way of saying
  // "7pm wherever the reader is", which is what a lodge meeting time
  // actually means. Defaults to 19:00 when no time is recorded, since a
  // calendar entry needs one and evening is the overwhelming norm.
  const time = (event.event_time as string | null)?.slice(0, 5) || '19:00'
  const [h, m] = time.split(':').map(Number)

  const stamp = (hh: number, mm: number) => {
    const d = event.event_date.replace(/-/g, '')
    return `${d}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`
  }

  const lodge = (event as any).tenants
  const lodgeName = lodge ? `${lodge.name} #${lodge.number}` : 'Lodge'

  const esc = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LodgeOS//Lodge Events//EN',
    'METHOD:PUBLISH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${icsUidForEvent(event.id)}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
    `DTSTART:${stamp(h, m)}`,
    // Two hours is the honest default for a stated communication; the
    // schema records no end time.
    `DTEND:${stamp(h + 2, m)}`,
    `SUMMARY:${esc(event.title)}`,
    // Public events may describe themselves; a private one gets the
    // lodge's name and nothing more. See the note at the top.
    `DESCRIPTION:${esc(((event as any).is_public ? event.description : null) || lodgeName)}`,
    event.location ? `LOCATION:${esc(event.location)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
      // Details can change up to the meeting; don't let a proxy pin an
      // old version into a brother's calendar.
      'Cache-Control': 'public, max-age=300',
    },
  })
}
