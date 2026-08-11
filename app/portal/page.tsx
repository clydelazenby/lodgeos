import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { OfficeDutyLink } from '@/components/lodge/OfficeDutyLink'
import { format } from 'date-fns'
import { upcomingSince } from '@/lib/dates'
import { degreeLabel, degreePillClass } from '@/lib/degrees'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('tenant_members')
      .select('*, tenants(id, name, number, primary_color, dues_amount)')
      .eq('user_id', user.id).eq('is_active', true).single(),
  ])

  if (!membership) redirect('/auth/login')
  const tenant = (membership as any).tenants
  const today = upcomingSince()

  const [{ data: events }, { data: payments }, { data: attendance }, { data: openMeeting }] = await Promise.all([
    supabase.from('lodge_events').select('*').eq('tenant_id', tenant.id).gte('event_date', today).order('event_date').limit(3),
    supabase.from('payments').select('*').eq('member_id', user.id).eq('status', 'succeeded').order('created_at', { ascending: false }).limit(3),
    // His own attendance only. RLS keeps it that way, and the explicit
    // member_id filter means the page does not depend on that alone.
    supabase.from('attendance')
      .select('id, status, created_at, lodge_events(id, title, event_date)')
      .eq('member_id', user.id).eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }),
    // A meeting that is open right now, so the dashboard can offer
    // check-in at the moment it is actually useful.
    supabase.from('lodge_events')
      .select('id, title')
      .eq('tenant_id', tenant.id)
      .not('opened_at', 'is', null)
      .is('closed_at', null)
      .limit(1).maybeSingle(),
  ])

  // Who to ask. "I have a question about my dues — who do I email?" had
  // no answer anywhere in the portal; a brother had to already know.
  const { data: officers } = await supabase
    .from('tenant_members')
    .select('lodge_role, profiles(first_name, last_name, email)')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .in('lodge_role', ['Secretary', 'Worshipful Master', 'Treasurer'])

  const duesDue = (membership as any).dues_status === 'due'

  const attended = (attendance ?? []).filter((a: any) => a.status === 'present')
  const thisYear = new Date().getFullYear()
  const attendedThisYear = attended.filter((a: any) => {
    const date = a.lodge_events?.event_date
    return date && new Date(`${date}T12:00:00`).getFullYear() === thisYear
  }).length

  // Already checked in to the meeting that is currently open?
  const checkedIntoOpen = Boolean(
    openMeeting && (attendance ?? []).some((a: any) => a.lodge_events?.id === openMeeting.id)
  )

  const initials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase() || '?'

  return (
    <div>
      {/* His own photo, beside his name. The avatar was uploadable on
          the profile page and then shown nowhere he would see it. */}
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(201,168,76,0.4)', flexShrink: 0 }}
          />
        ) : (
          <Link
            href="/portal/profile"
            title="Add your photo"
            style={{ width: 72, height: 72, borderRadius: '50%', border: '2px dashed rgba(201,168,76,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#C9A84C', textDecoration: 'none', flexShrink: 0 }}
          >
            {initials}
          </Link>
        )}
        <div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>BROTHER PORTAL</div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
            Welcome, Brother <span style={{ color: '#C9A84C' }}>{profile?.first_name}</span>
          </h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
            {tenant.name} #{tenant.number} ·{' '}
            {/* His chair, and what it means, in the line that names it.
                A brother with no office sees his degree instead, which
                has no duties to open. */}
            {(membership as any).lodge_role ? (
              <OfficeDutyLink
                tenantId={tenant.id}
                office={(membership as any).lodge_role}
                allHref="/portal/duties"
                style={{ color: '#C9A84C', fontStyle: 'italic' }}
              />
            ) : (
              degreeLabel((membership as any).degree)
            )}
          </p>
        </div>
      </div>

      {/* Check-in, shown only while a meeting is actually open. */}
      {openMeeting && (
        <div style={{ background: checkedIntoOpen ? 'rgba(93,190,133,0.12)' : 'rgba(201,168,76,0.12)', border: `1px solid ${checkedIntoOpen ? 'rgba(93,190,133,0.3)' : 'rgba(201,168,76,0.35)'}`, padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: checkedIntoOpen ? '#5DBE85' : '#C9A84C', marginBottom: '0.25rem' }}>
              {checkedIntoOpen ? 'You are checked in' : 'Meeting in progress'}
            </div>
            <p style={{ fontSize: '0.9rem', color: '#B8B0A0', margin: 0 }}>
              {(openMeeting as any).title}
              {checkedIntoOpen
                ? ' — your attendance has been recorded.'
                : ' — scan the meeting code at the door to record your attendance.'}
            </p>
          </div>
          {!checkedIntoOpen && (
            <Link href="/portal/check-in" className="btn-gold" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>Check In →</Link>
          )}
        </div>
      )}

      {/* Dues alert */}
      {duesDue && (
        <div style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: '#EC5B4B', marginBottom: '0.25rem' }}>Annual Dues Outstanding</div>
            <p style={{ fontSize: '0.9rem', color: '#B8B0A0', margin: 0 }}>Your {new Date().getFullYear()} dues of <strong style={{ color: '#F5F0E8' }}>${tenant.dues_amount}</strong> are due. Pay now to maintain good standing.</p>
          </div>
          <Link href="/portal/dues" className="btn-gold" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>Pay Dues Now →</Link>
        </div>
      )}

      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', marginBottom: '2rem' }}>
        <div style={{ background: '#141C2E', padding: '1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Degree</div>
          <span className={`pill ${degreePillClass((membership as any).degree)}`}>{degreeLabel((membership as any).degree)}</span>
        </div>
        <div style={{ background: '#141C2E', padding: '1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Attended {thisYear}</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', fontWeight: 700, color: '#F5F0E8' }}>{attendedThisYear}</div>
        </div>
        <div style={{ background: '#141C2E', padding: '1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Dues Status</div>
          <span className={`pill pill-${(membership as any).dues_status}`}>{(membership as any).dues_status}</span>
        </div>
        <div style={{ background: '#141C2E', padding: '1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Amount Due</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', fontWeight: 700, color: duesDue ? '#EC5B4B' : '#5DBE85' }}>{duesDue ? `$${tenant.dues_amount}` : '$0'}</div>
        </div>
        <div style={{ background: '#141C2E', padding: '1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Role</div>
          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', color: '#F5F0E8' }}>{(membership as any).lodge_role || 'Member'}</div>
          {/* Only for a brother with NO office. One with a chair now
              has it underlined in the greeting above, and two links to
              the same thing on one screen is one too many. */}
          {!(membership as any).lodge_role && (
            <Link
              href="/portal/duties"
              style={{ display: 'inline-block', marginTop: '0.5rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.12em', color: '#C9A84C', textDecoration: 'none' }}
            >
              OFFICER DUTIES →
            </Link>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Upcoming events */}
        <div className="data-box">
          {/* The "All →" link pointed at /portal/events, which has never
              existed — a 404 one tap from the brother's landing page.
              This box already lists the upcoming events, so there is
              nowhere further to send him. */}
          <div className="data-box-head"><span>Upcoming Events</span></div>
          {events && events.length > 0 ? events.map((ev: any, i: number) => (
            <div key={ev.id} style={{ padding: '0.85rem 1.4rem', borderBottom: i < events.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8', marginBottom: '2px' }}>{ev.title}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{format(new Date(ev.event_date + 'T12:00:00'), 'MMM d, yyyy')}{ev.dress_code && ` · ${ev.dress_code}`}</div>
            </div>
          )) : <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>No upcoming events.</div>}
        </div>

        {/* Payment history */}
        <div className="data-box">
          <div className="data-box-head"><span>Payment History</span><Link href="/portal/dues" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>All →</Link></div>
          {payments && payments.length > 0 ? payments.map((p: any, i: number) => (
            <div key={p.id} style={{ padding: '0.85rem 1.4rem', borderBottom: i < payments.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: '#F5F0E8' }}>Dues {p.dues_year}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{format(new Date(p.created_at), 'MMM d, yyyy')}</div>
              </div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: '#5DBE85', fontWeight: 700 }}>${p.amount}</div>
            </div>
          )) : <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>No payments yet.</div>}
        </div>
      </div>

      {/* Who to ask, with the office each man actually holds. */}
      {officers && officers.length > 0 && (
        <div className="data-box" style={{ marginTop: '1rem' }}>
          <div className="data-box-head"><span>Who to Ask</span></div>
          {officers.map((o: any, i: number) => (
            <div key={`${o.lodge_role}-${i}`} style={{ padding: '0.85rem 1.4rem', borderBottom: i < officers.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8' }}>
                  {o.profiles?.first_name} {o.profiles?.last_name}
                </div>
                <div style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.85rem', color: '#C9A84C' }}>{o.lodge_role}</div>
              </div>
              {o.profiles?.email && (
                <a href={`mailto:${o.profiles.email}`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#B8B0A0', textDecoration: 'none', alignSelf: 'center' }}>
                  {o.profiles.email}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Attendance — his own record, which he could not see anywhere
          before this. Recorded by the Secretary at the door or by his
          own check-in; either way it is his record to read. */}
      <div className="data-box" style={{ marginTop: '1rem' }}>
        <div className="data-box-head">
          <span>My Attendance</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
            {attended.length} recorded
          </span>
        </div>
        {attendance && attendance.length > 0 ? attendance.slice(0, 10).map((a: any, i: number) => (
          <div key={a.id} style={{ padding: '0.85rem 1.4rem', borderBottom: i < Math.min(attendance.length, 10) - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8', marginBottom: '2px' }}>
                {a.lodge_events?.title ?? 'Lodge meeting'}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>
                {a.lodge_events?.event_date
                  ? format(new Date(a.lodge_events.event_date + 'T12:00:00'), 'MMM d, yyyy')
                  : format(new Date(a.created_at), 'MMM d, yyyy')}
              </div>
            </div>
            <span className={`pill pill-${a.status}`}>{a.status}</span>
          </div>
        )) : (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>
            No attendance recorded yet. Check in at the next meeting and it will appear here.
          </div>
        )}
      </div>
    </div>
  )
}
