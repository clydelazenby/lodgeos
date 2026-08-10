import { createClient } from '@/lib/supabase/server'
import { getTenantBySlug } from '@/lib/supabase/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { T } from '@/lib/designTokens'
import { EventActions } from '@/components/lodge/EventActions'
import type { Metadata } from 'next'

/**
 * One event, on its own page.
 *
 * The events list was a seven-column table — date, title, location,
 * type, public flag, an RSVP tally, and two actions — which on a phone
 * meant scrolling sideways past everything to reach anything. Widening
 * the table was never going to fix that; the row was carrying a whole
 * record's worth of information in a horizontal strip.
 *
 * This gives each event the room to show what the list could only
 * summarise: WHO replied rather than three counts, who has not replied
 * at all (the useful list for a Secretary chasing numbers), and the
 * recorded attendance once the meeting has happened. The list is
 * reduced to date, title and headcount, with the detail one tap away.
 */

const TYPE_LABEL: Record<string, string> = {
  degree: 'Degree Work',
  stated_communication: 'Stated Communication',
  grand_lodge: 'Grand Lodge',
  social: 'Social',
  other: 'Other',
}

const TYPE_PILL: Record<string, string> = {
  degree: 'pill-fc', grand_lodge: 'pill-mm', stated_communication: 'pill-ea',
  social: 'pill-active', other: 'pill-new',
}

export async function generateMetadata({
  params,
}: { params: { slug: string; eventId: string } }): Promise<Metadata> {
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('lodge_events')
    .select('title, event_date')
    .eq('id', params.eventId)
    .maybeSingle()

  if (!event) return { title: 'Event Not Found' }
  return { title: `${event.title} — ${format(new Date(event.event_date + 'T12:00:00'), 'MMM d, yyyy')}` }
}

export default async function EventDetailPage({
  params,
}: { params: { slug: string; eventId: string } }) {
  const supabase = await createClient()
  const tenant = await getTenantBySlug(params.slug)
  if (!tenant) notFound()

  // Scoped to the tenant so an event id from another lodge 404s rather
  // than rendering, even for a valid officer of this one.
  const { data: event } = await supabase
    .from('lodge_events')
    .select('*')
    .eq('id', params.eventId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (!event) notFound()

  const [{ data: rsvps }, { data: members }, { data: attendance }] = await Promise.all([
    supabase.from('event_rsvps').select('user_id, response, responded_at').eq('event_id', event.id),
    supabase
      .from('tenant_members')
      .select('user_id, lodge_role, profiles(first_name, last_name, email)')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
    supabase.from('attendance').select('member_id, status').eq('event_id', event.id),
  ])

  const nameOf = new Map<string, string>()
  for (const m of members ?? []) {
    const p = (m as any).profiles
    nameOf.set((m as any).user_id, `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown')
  }

  const byResponse = { yes: [] as string[], maybe: [] as string[], no: [] as string[] }
  const responded = new Set<string>()
  for (const r of rsvps ?? []) {
    const key = (r as any).response as 'yes' | 'maybe' | 'no'
    if (byResponse[key]) byResponse[key].push(nameOf.get((r as any).user_id) ?? 'Unknown')
    responded.add((r as any).user_id)
  }

  // The list a Secretary actually chases before a degree night.
  const noReply = (members ?? [])
    .filter((m: any) => !responded.has(m.user_id))
    .map((m: any) => nameOf.get(m.user_id) ?? 'Unknown')

  const attendanceMap = new Map<string, string>()
  for (const a of attendance ?? []) attendanceMap.set((a as any).member_id, (a as any).status)
  const presentCount = Array.from(attendanceMap.values()).filter((s) => s === 'present').length

  const eventDate = new Date(event.event_date + 'T12:00:00')
  const isPast = eventDate < new Date(new Date().toDateString())

  const detail = (label: string, value: React.ReactNode) => (
    <div>
      <div style={{ fontFamily: T.mono, fontSize: '0.56rem', letterSpacing: '0.2em', color: T.gold, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1rem', color: T.ink }}>{value}</div>
    </div>
  )

  const nameList = (names: string[], tone: string) =>
    names.length === 0
      ? <span style={{ color: T.inkFainter, fontStyle: 'italic' }}>None</span>
      : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {names.sort().map((n) => (
            <span key={n} style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem', color: tone }}>Bro. {n}</span>
          ))}
        </div>
      )

  return (
    <div>
      <Link
        href={`/lodge/${params.slug}/events`}
        style={{ fontFamily: T.mono, fontSize: '0.6rem', letterSpacing: '0.15em', color: T.inkFaint, textDecoration: 'none', display: 'inline-block', marginBottom: '1rem' }}
      >
        ← ALL EVENTS
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
            <span className={`pill ${TYPE_PILL[event.event_type] ?? 'pill-new'}`}>{TYPE_LABEL[event.event_type] ?? event.event_type}</span>
            <span className={`pill ${event.is_public ? 'pill-active' : 'pill-new'}`}>{event.is_public ? 'Public' : 'Members only'}</span>
            {event.opened_at && !event.closed_at && <span className="pill pill-active">Lodge open</span>}
            {isPast && <span className="pill pill-new">Past</span>}
          </div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: T.ink, margin: 0 }}>{event.title}</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: T.inkFaint, margin: '4px 0 0' }}>
            {format(eventDate, 'EEEE, MMMM d, yyyy')}
            {event.event_time ? ` at ${event.event_time.slice(0, 5)}` : ''}
          </p>
        </div>

        <EventActions
          tenantId={tenant.id}
          eventId={event.id}
          slug={params.slug}
          eventTitle={event.title}
          isPast={isPast}
        />
      </div>

      <div className="data-box" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
          {detail('Location', event.location || <span style={{ color: T.inkFainter }}>Not set</span>)}
          {detail('Dress Code', event.dress_code || <span style={{ color: T.inkFainter }}>Not set</span>)}
          {detail('Expected', `${byResponse.yes.length} attending`)}
          {isPast && detail('Recorded Attendance', attendanceMap.size > 0
            ? `${presentCount} present`
            : <span style={{ color: T.inkFainter }}>Not recorded</span>)}
        </div>

        {event.description && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: T.mono, fontSize: '0.56rem', letterSpacing: '0.2em', color: T.gold, textTransform: 'uppercase', marginBottom: 6 }}>Description</div>
            <p style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{event.description}</p>
          </div>
        )}
      </div>

      <div className="data-box" style={{ padding: '1.5rem' }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: T.ink, marginBottom: '1.25rem' }}>
          Responses <span style={{ fontFamily: T.mono, fontSize: '0.62rem', color: T.inkFaint }}>· {responded.size} of {members?.length ?? 0} replied</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1.5rem' }}>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: '0.56rem', letterSpacing: '0.2em', color: T.success, textTransform: 'uppercase', marginBottom: 8 }}>
              Attending ({byResponse.yes.length})
            </div>
            {nameList(byResponse.yes, T.ink)}
          </div>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: '0.56rem', letterSpacing: '0.2em', color: T.gold, textTransform: 'uppercase', marginBottom: 8 }}>
              Maybe ({byResponse.maybe.length})
            </div>
            {nameList(byResponse.maybe, T.inkFaint)}
          </div>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: '0.56rem', letterSpacing: '0.2em', color: T.danger, textTransform: 'uppercase', marginBottom: 8 }}>
              Cannot Attend ({byResponse.no.length})
            </div>
            {nameList(byResponse.no, T.inkFaint)}
          </div>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: '0.56rem', letterSpacing: '0.2em', color: T.inkFainter, textTransform: 'uppercase', marginBottom: 8 }}>
              No Reply ({noReply.length})
            </div>
            {nameList(noReply, T.inkFainter)}
          </div>
        </div>
      </div>

      {isPast && attendanceMap.size > 0 && (
        <div className="data-box" style={{ padding: '1.5rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: T.ink, marginBottom: '1rem' }}>Attendance Recorded</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.4rem 1.5rem' }}>
            {Array.from(attendanceMap.entries()).map(([memberId, status]) => (
              <div key={memberId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem' }}>
                <span style={{ color: T.ink }}>Bro. {nameOf.get(memberId) ?? 'Unknown'}</span>
                <span style={{
                  fontFamily: T.mono, fontSize: '0.6rem', whiteSpace: 'nowrap',
                  color: status === 'present' ? T.success : status === 'excused' ? T.gold : T.inkFainter,
                }}>
                  {status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
