/**
 * Builds an RFC 5545 (iCalendar) VEVENT string with METHOD:REQUEST.
 *
 * Confirmed against Resend's own attachment API docs: their attachment
 * object exposes only content/filename/path/contentId — no way to set a
 * custom Content-Type. This means Outlook's inline Accept/Decline
 * buttons (which require `text/calendar; method=REQUEST` as the actual
 * MIME type) cannot be achieved via Resend's attachments. The .ics still
 * attaches fine (Gmail auto-detects it), and the real RSVP mechanism is
 * the one-tap body links in the invite email — see lib/email/index.ts's
 * sendEventInviteEmail, which is client-agnostic rather than depending
 * on each mail client's MIME handling.
 *
 * Line folding: RFC 5545 technically requires folding lines over 75
 * octets. Every field here is realistically short enough in lodge-event
 * usage to never approach that limit, so folding is intentionally not
 * implemented.
 */

type IcsEvent = {
  uid: string
  sequence: number
  title: string
  description?: string
  location?: string
  startUtc: Date
  endUtc: Date
  organizerEmail: string
  organizerName: string
  attendeeEmail: string
  attendeeName: string
  method?: 'REQUEST' | 'CANCEL'
}

function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
}

export function buildIcsEvent(ev: IcsEvent): string {
  const method = ev.method ?? 'REQUEST'
  const status = method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'
  const now = toIcsUtc(new Date())

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LodgeOS//Lodge Events//EN',
    `METHOD:${method}`,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `SEQUENCE:${ev.sequence}`,
    `STATUS:${status}`,
    `DTSTAMP:${now}`,
    `DTSTART:${toIcsUtc(ev.startUtc)}`,
    `DTEND:${toIcsUtc(ev.endUtc)}`,
    `SUMMARY:${escapeIcsText(ev.title)}`,
    ev.description ? `DESCRIPTION:${escapeIcsText(ev.description)}` : '',
    ev.location ? `LOCATION:${escapeIcsText(ev.location)}` : '',
    `ORGANIZER;CN=${escapeIcsText(ev.organizerName)}:mailto:${ev.organizerEmail}`,
    `ATTENDEE;CN=${escapeIcsText(ev.attendeeName)};RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${ev.attendeeEmail}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')
}

export function icsUidForEvent(eventId: string): string {
  return `event-${eventId}@lodgeos.com`
}

/**
 * lodge_events has no end_time column, so this assumes a 2-hour default
 * duration — a reasonable stated-meeting length, but a guess, not data.
 */
export function eventTimesFromRow(eventDate: string, eventTime: string | null): { start: Date; end: Date } {
  const start = eventTime
    ? new Date(`${eventDate}T${eventTime}`)
    : new Date(`${eventDate}T19:00:00`)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  return { start, end }
}
