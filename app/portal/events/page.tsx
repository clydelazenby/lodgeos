import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { upcomingSince } from '@/lib/dates'
import { RsvpButtons } from '@/components/portal/RsvpButtons'
import { CalendarSubscribe } from '@/components/lodge/CalendarSubscribe'

/**
 * The lodge calendar, and the brother's answer to each invitation.
 *
 * /portal/events was a link in the portal navigation pointing at a page
 * that had never existed — a 404 sitting in the main nav, since removed.
 * This is the page it should have pointed at.
 *
 * The dashboard shows the next three events; this shows all of them,
 * past ones included, because "when was the last degree work" is a
 * question a brother asks as often as "when is the next meeting".
 */
export default async function PortalEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id, tenants(calendar_token)')
    .eq('user_id', user.id).eq('is_active', true).single()

  if (!membership) redirect('/auth/login')
  const tenantId = (membership as any).tenant_id
  const calendarToken = (membership as any).tenants?.calendar_token ?? null
  const today = upcomingSince()

  const [{ data: events }, { data: myRsvps }] = await Promise.all([
    supabase
      .from('lodge_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('event_date', { ascending: false })
      .limit(60),
    supabase
      .from('event_rsvps')
      .select('event_id, response')
      .eq('user_id', user.id),
  ])

  const answerFor = new Map<string, 'yes' | 'no' | 'maybe'>()
  for (const r of myRsvps ?? []) answerFor.set((r as any).event_id, (r as any).response)

  const upcoming = (events ?? []).filter((e: any) => e.event_date >= today)
    .sort((a: any, b: any) => a.event_date.localeCompare(b.event_date))
  const past = (events ?? []).filter((e: any) => e.event_date < today)

  const EventRow = ({ e, showRsvp }: { e: any; showRsvp: boolean }) => (
    <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ minWidth: 200, flex: 1 }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: '#F5F0E8', marginBottom: 3 }}>{e.title}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>
          {format(new Date(e.event_date + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
          {e.event_time ? ` · ${e.event_time}` : ''}
          {e.location ? ` · ${e.location}` : ''}
          {e.dress_code ? ` · ${e.dress_code}` : ''}
        </div>
        {e.description && (
          <p style={{ fontFamily: 'Crimson Pro, serif', color: '#B8B0A0', fontSize: '0.92rem', lineHeight: 1.6, margin: '8px 0 0' }}>
            {e.description}
          </p>
        )}
      </div>
      {showRsvp && <RsvpButtons eventId={e.id} current={answerFor.get(e.id) ?? null} />}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>THE CALENDAR</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Events</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
          Answer an invitation here if you have lost the email.
        </p>
      </div>

      {/* SUBSCRIBE ONCE, NOT MONTHLY.
          The per-event download below still exists and still works, but
          it needs a fresh link for every meeting. This is added to a
          phone once and stays current on its own. */}
      {calendarToken && (
        <div className="data-box" style={{ marginBottom: '1rem' }}>
          <div className="data-box-head">
            <span>The Lodge Calendar</span>
          </div>
          <CalendarSubscribe token={calendarToken} />
        </div>
      )}

      <div className="data-box" style={{ marginBottom: '1rem' }}>
        <div className="data-box-head">
          <span>Upcoming</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>{upcoming.length}</span>
        </div>
        {upcoming.length > 0
          ? upcoming.map((e: any) => <EventRow key={e.id} e={e} showRsvp />)
          : <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>Nothing on the calendar yet.</div>}
      </div>

      {past.length > 0 && (
        <div className="data-box">
          <div className="data-box-head">
            <span>Past</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>{past.length}</span>
          </div>
          {past.map((e: any) => <EventRow key={e.id} e={e} showRsvp={false} />)}
        </div>
      )}
    </div>
  )
}
