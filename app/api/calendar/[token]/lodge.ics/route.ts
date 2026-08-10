import { createServiceClient } from '@/lib/supabase/server'
import { icsUidForEvent, foldIcsLine } from '@/lib/ics'

/**
 * The whole lodge calendar, as a subscription.
 *
 * The per-event .ics route solves the wrong half of the problem: a
 * brother adds one meeting, and next month he needs another link and
 * has to remember to tap it. This is added once and then forgotten
 * about — the calendar app re-fetches it on its own schedule, so a
 * meeting moved on Tuesday moves in fifty pockets on Tuesday.
 *
 * ACCESS. Calendar clients send no cookies and cannot authenticate; iOS,
 * Google Calendar and Outlook open this URL with nothing but the URL. So
 * the URL is the credential — an unguessable per-lodge token (migration
 * 027), not the public slug, because this carries the whole schedule
 * including events not marked public. Rotating the token in Settings
 * revokes every subscription at once.
 *
 * WHAT IT DOES NOT CARRY. Descriptions are included; attendance, RSVPs
 * and anything about individual brothers are not. A calendar file ends
 * up synced to whatever cloud account the reader uses, and the lodge's
 * schedule is a different kind of thing from its roster.
 */

// A year and a half back. Old meetings are what a calendar is consulted
// for — "when did we last confer a Fellowcraft?" — but the whole
// history would make every client re-download years of dead entries on
// every poll.
const MONTHS_OF_HISTORY = 18

export const dynamic = 'force-dynamic'

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
}

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  // A malformed token should not reach the database as a uuid comparison
  // error — Postgres raises on an invalid uuid literal, which would be a
  // 500 where the honest answer is 404.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.token)) {
    return new Response('Not found', { status: 404 })
  }

  const supabase = createServiceClient()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, number')
    .eq('calendar_token', params.token)
    .maybeSingle()

  if (!tenant) {
    return new Response('Not found', { status: 404 })
  }

  const since = new Date()
  since.setMonth(since.getMonth() - MONTHS_OF_HISTORY)

  const { data: events } = await supabase
    .from('lodge_events')
    .select('id, title, event_date, event_time, location, description')
    .eq('tenant_id', (tenant as any).id)
    .gte('event_date', since.toISOString().slice(0, 10))
    .order('event_date')

  const lodgeName = `${(tenant as any).name} #${(tenant as any).number}`
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LodgeOS//Lodge Calendar//EN',
    'METHOD:PUBLISH',
    'CALSCALE:GREGORIAN',
    // Both spellings on purpose. X-WR-CALNAME is what Apple and Google
    // read; NAME is the RFC 7986 standard property that newer clients
    // prefer. Without one of them the subscription shows up in the
    // sidebar as the raw URL.
    `X-WR-CALNAME:${esc(lodgeName)}`,
    `NAME:${esc(lodgeName)}`,
    `X-WR-CALDESC:${esc(`Meetings and events of ${lodgeName}`)}`,
    // A polling hint. Clients treat it as advisory, but without it some
    // default to refetching only once a day, which is too slow for a
    // meeting moved the evening before.
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ]

  for (const event of events ?? []) {
    const e = event as any

    /**
     * event_time is a bare `time` with no zone. Emitted as FLOATING
     * local time — no Z, no TZID — which is the iCalendar way of saying
     * "7pm wherever the reader is". That is exactly what a lodge meeting
     * time means, and treating it as UTC would show a 7pm meeting at 2pm
     * for a US lodge. Matches the single-event route.
     */
    const time = (e.event_time as string | null)?.slice(0, 5) || '19:00'
    const [h, m] = time.split(':').map(Number)
    const day = String(e.event_date).replace(/-/g, '')
    const at = (hh: number, mm: number) =>
      `${day}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`

    // Two hours is the honest default for a stated communication; the
    // schema records no end time. Clamped so a meeting called for 23:00
    // does not emit hour 25, which is not a valid timestamp.
    const endHour = Math.min(h + 2, 23)
    const endMinute = endHour === 23 && h + 2 > 23 ? 59 : m

    lines.push(
      'BEGIN:VEVENT',
      // Same UID scheme as the single-event download, so a brother who
      // previously added one meeting by hand gets it MERGED with the
      // subscription rather than duplicated in his calendar.
      `UID:${icsUidForEvent(e.id)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${at(h, m)}`,
      `DTEND:${at(endHour, endMinute)}`,
      foldIcsLine(`SUMMARY:${esc(e.title)}`),
      foldIcsLine(`DESCRIPTION:${esc(e.description || lodgeName)}`),
      ...(e.location ? [foldIcsLine(`LOCATION:${esc(e.location)}`)] : []),
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // Inline, not an attachment: a subscription is fetched by a
      // calendar client, and Content-Disposition: attachment makes some
      // of them treat it as a one-off import instead.
      'Content-Disposition': 'inline; filename="lodge.ics"',
      'Cache-Control': 'public, max-age=1800',
    },
  })
}
