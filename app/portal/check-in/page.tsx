import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { SelfCheckinScanner } from '@/components/portal/SelfCheckinScanner'

/**
 * Self check-in for a brother at a meeting.
 *
 * The route that does the writing (/api/attendance/qr-self-checkin)
 * already existed and was reachable from nowhere — there was no page
 * in the portal that let a brother use it. This is that page.
 */
export default async function PortalCheckInPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id, tenants(name, number)')
    .eq('user_id', user.id).eq('is_active', true).single()

  if (!membership) redirect('/auth/login')
  const tenantId = (membership as any).tenant_id

  const { data: openMeeting } = await supabase
    .from('lodge_events')
    .select('id, title, event_date')
    .eq('tenant_id', tenantId)
    .not('opened_at', 'is', null)
    .is('closed_at', null)
    .limit(1).maybeSingle()

  // Whether he is already down as present for it. The route itself
  // upserts, so a second check-in is harmless — but telling him he is
  // already recorded is better than letting him scan again to find out.
  const { data: existing } = openMeeting
    ? await supabase
        .from('attendance')
        .select('id, status')
        .eq('member_id', user.id)
        .eq('event_id', (openMeeting as any).id)
        .maybeSingle()
    : { data: null }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>ATTENDANCE</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Check In</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
          Scan the code displayed at the meeting to record your attendance.
        </p>
      </div>

      <div className="data-box">
        <div className="data-box-head">
          <span>{openMeeting ? (openMeeting as any).title : 'No meeting open'}</span>
          {openMeeting && (openMeeting as any).event_date && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
              {format(new Date((openMeeting as any).event_date + 'T12:00:00'), 'MMM d, yyyy')}
            </span>
          )}
        </div>

        <div style={{ padding: '1.5rem' }}>
          {!openMeeting ? (
            <p style={{ color: '#B8B0A0', fontStyle: 'italic', margin: 0, lineHeight: 1.7 }}>
              No meeting is open at the moment. Check-in becomes available once an officer opens the
              meeting — the code is displayed at the door. Your past attendance is on your{' '}
              <Link href="/portal" style={{ color: '#C9A84C', textDecoration: 'none' }}>dashboard</Link>.
            </p>
          ) : existing ? (
            <div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#5DBE85', marginBottom: '0.5rem' }}>
                ✓ You are already checked in
              </div>
              <p style={{ color: '#B8B0A0', margin: 0, lineHeight: 1.7 }}>
                Your attendance at {(openMeeting as any).title} is recorded as{' '}
                <strong style={{ color: '#F5F0E8' }}>{(existing as any).status}</strong>. Nothing further to do.
              </p>
            </div>
          ) : (
            <SelfCheckinScanner />
          )}
        </div>
      </div>
    </div>
  )
}
