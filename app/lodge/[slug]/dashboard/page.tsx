import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
<<<<<<< HEAD
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { T, pillTone } from '@/lib/designTokens'

// Traditional fixed lodge stations, same list as the prior vellum
// dashboard — carried over unchanged, since this is a visual reskin,
// not a data-model change. Matched against lodge_role (the free-text
// display label), not tenant_role (the permission tier).
const STATIONS = [
  'Worshipful Master', 'Senior Warden', 'Junior Warden',
  'Treasurer', 'Secretary',
  'Senior Deacon', 'Junior Deacon',
  'Senior Steward', 'Junior Steward',
  'Chaplain', 'Marshal', 'Tyler',
]

// Officers tracked individually on the attendance heatmap — mirrors
// the reference image's row labels (WM, SW, JW, Treas., Sec.) plus an
// aggregate "Mem." row for everyone else, since a real lodge officer
// wants to see AT A GLANCE whether leadership showed up, not just a
// generic per-member grid that would be too tall to read.
const HEATMAP_ROWS = [
  { label: 'WM', station: 'Worshipful Master' },
  { label: 'SW', station: 'Senior Warden' },
  { label: 'JW', station: 'Junior Warden' },
  { label: 'Treas.', station: 'Treasurer' },
  { label: 'Sec.', station: 'Secretary' },
]

type ActivityItem = { id: string; at: string; text: string; icon: string; tone: 'gold' | 'success' | 'info' }

const monthLabel = (m: number) => new Date(2000, m, 1).toLocaleString('en-US', { month: 'short' })
=======
import { format } from 'date-fns'
import Link from 'next/link'
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d

export default async function LodgeDashboardPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
<<<<<<< HEAD
  const yearStart = `${new Date().getFullYear()}-01-01`
=======
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d

  const { data: tenant } = await supabase.from('tenants').select('*').eq('slug', params.slug).single()
  if (!tenant) notFound()

  const [
    { count: memberCount },
    { count: petitionCount },
    { count: dueCount },
    { data: events },
    { data: recentPayments },
<<<<<<< HEAD
    { data: allActiveMembers },
    { data: recentPetitions },
    { data: recentComms },
    { data: yearAttendance },
    { count: paidCount },
=======
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
  ] = await Promise.all([
    supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_active', true),
    supabase.from('petitions').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'new'),
    supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('dues_status', 'due').eq('is_active', true),
    supabase.from('lodge_events').select('*').eq('tenant_id', tenant.id).gte('event_date', today).order('event_date').limit(4),
    supabase.from('payments').select('*, profiles(first_name, last_name)').eq('tenant_id', tenant.id).eq('status', 'succeeded').order('created_at', { ascending: false }).limit(5),
<<<<<<< HEAD
    supabase.from('tenant_members').select('user_id, lodge_role, profiles(first_name, last_name)').eq('tenant_id', tenant.id).eq('is_active', true),
    supabase.from('petitions').select('id, first_name, last_name, created_at').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(4),
    supabase.from('communications').select('id, subject, created_at, is_draft').eq('tenant_id', tenant.id).eq('is_draft', false).order('created_at', { ascending: false }).limit(4),
    // Attendance joined through lodge_events for its date, filtered to
    // this calendar year — the attendance table itself has no month
    // column, only an event_id, so the month has to be derived from
    // the linked event's real event_date, not fabricated.
    supabase.from('attendance').select('member_id, status, lodge_events!inner(event_date)').eq('tenant_id', tenant.id).gte('lodge_events.event_date', yearStart),
    supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('dues_status', 'paid').eq('is_active', true),
  ])

  const duesCollectedPct = memberCount ? Math.round(((paidCount ?? 0) / memberCount) * 100) : 0

  // Map each station-holder's user_id to their station label, so the
  // heatmap can look up "did this specific person attend this month"
  // by role rather than by name matching.
  const holderByStation: Record<string, string> = {} // station -> user_id
  for (const m of allActiveMembers ?? []) {
    const role = (m as any).lodge_role?.trim()
    if (role && !holderByStation[role]) holderByStation[role] = (m as any).user_id
  }

  // Build a month x row presence grid: for each of the 5 tracked
  // officer stations, and each month 0-11, was that station's current
  // holder marked present at ANY event that month. A holder who took
  // office mid-year will show correctly empty for months before they
  // held the role, since this only checks THEIR user_id's attendance
  // records, not the station's attendance across whoever held it historically.
  const heatmapData: Record<string, boolean[]> = {}
  for (const row of HEATMAP_ROWS) {
    const holderId = holderByStation[row.station]
    const monthsPresent = new Array(12).fill(false)
    if (holderId) {
      for (const a of yearAttendance ?? []) {
        if ((a as any).member_id === holderId && (a as any).status === 'present') {
          const eventDate = (a as any).lodge_events?.event_date
          if (eventDate) monthsPresent[new Date(eventDate + 'T12:00:00').getMonth()] = true
        }
      }
    }
    heatmapData[row.label] = monthsPresent
  }
  // Aggregate "Mem." row: count of all OTHER active members present
  // that month, bucketed into color intensity rather than true/false,
  // since this row represents many people, not one — a single
  // present/absent boolean wouldn't make sense for an aggregate.
  const memberMonthCounts = new Array(12).fill(0)
  const trackedHolderIds = new Set(Object.values(holderByStation))
  for (const a of yearAttendance ?? []) {
    if ((a as any).status === 'present' && !trackedHolderIds.has((a as any).member_id)) {
      const eventDate = (a as any).lodge_events?.event_date
      if (eventDate) memberMonthCounts[new Date(eventDate + 'T12:00:00').getMonth()]++
    }
  }
  const maxMemberCount = Math.max(1, ...memberMonthCounts)

  const activity: ActivityItem[] = [
    ...(recentPayments ?? []).map((p: any): ActivityItem => ({
      id: `pay-${p.id}`, at: p.created_at, icon: '$', tone: 'success',
      text: `${p.profiles ? `${p.profiles.first_name} ${p.profiles.last_name}` : 'A brother'} paid ${p.dues_year ?? ''} dues`,
    })),
    ...(recentPetitions ?? []).map((p: any): ActivityItem => ({
      id: `pet-${p.id}`, at: p.created_at, icon: '◈', tone: 'gold',
      text: `New member petition from ${p.first_name} ${p.last_name}`,
    })),
    ...(recentComms ?? []).map((c: any): ActivityItem => ({
      id: `com-${c.id}`, at: c.created_at, icon: '✉', tone: 'info',
      text: `Notice sent: "${c.subject}"`,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6)

  const kpis = [
    { icon: '◈', label: 'Total Members', value: memberCount ?? 0, sub: 'Active Members', tone: 'gold' as const },
    { icon: '$', label: 'Dues Collection', value: `${duesCollectedPct}%`, sub: 'Collected this year', tone: 'gold' as const, bar: duesCollectedPct },
    { icon: '⚑', label: 'New Petitions', value: petitionCount ?? 0, sub: 'Awaiting review', tone: 'gold' as const, href: `/lodge/${params.slug}/petitions` },
    { icon: '⚠', label: 'Dues Outstanding', value: dueCount ?? 0, sub: 'Brothers with balance', tone: 'danger' as const, href: `/lodge/${params.slug}/dues` },
  ]

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: T.display, fontSize: '1.65rem', fontWeight: 600, color: T.ink, margin: 0 }}>
          Good Evening, {tenant.name} #{tenant.number}
        </h1>
        <p style={{ fontFamily: T.body, color: T.inkFaint, margin: '4px 0 0', fontSize: '0.9rem' }}>
          {tenant.city ? `${tenant.city}, ${tenant.state}` : 'Lodge Admin Dashboard'} · {tenant.plan} plan
        </p>
      </div>

      {/* KPI cards — icon-badge style matching the reference: a circular
          gold-tinted icon badge, large headline number, label + sub-label. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {kpis.map(kpi => {
          const tone = pillTone(kpi.tone)
          return (
            <div key={kpi.label} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.9rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: tone.bg, border: `1px solid ${tone.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: tone.text, flexShrink: 0 }}>
                  {kpi.icon}
                </div>
                <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.1em', color: T.inkFaint, textTransform: 'uppercase' }}>{kpi.label}</div>
              </div>
              <div style={{ fontFamily: T.display, fontSize: '1.9rem', fontWeight: 600, color: T.ink, lineHeight: 1, marginBottom: '4px' }}>{kpi.value}</div>
              <div style={{ fontFamily: T.body, fontSize: '0.78rem', color: T.inkFaint }}>{kpi.sub}</div>
              {kpi.bar !== undefined && (
                <div style={{ marginTop: '10px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${kpi.bar}%`, background: T.gold, borderRadius: '2px' }} />
                </div>
              )}
              {kpi.href && <Link href={kpi.href} style={{ fontFamily: T.mono, fontSize: '10px', color: T.gold, textDecoration: 'none', display: 'block', marginTop: '8px' }}>View →</Link>}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: '1.25rem', marginBottom: '1.75rem', alignItems: 'start' }}>
        {/* Upcoming events */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: T.display, fontSize: '0.9rem', fontWeight: 600, color: T.ink }}>Upcoming Events</span>
            <Link href={`/lodge/${params.slug}/events`} style={{ fontFamily: T.mono, fontSize: '10px', color: T.gold, textDecoration: 'none' }}>All →</Link>
          </div>
          {events && events.length > 0 ? events.map((ev: any, i: number) => (
            <div key={ev.id} style={{ padding: '0.85rem 1.25rem', borderBottom: i < events.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '38px', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: T.mono, fontSize: '9px', color: T.gold, letterSpacing: '0.05em' }}>{format(new Date(ev.event_date + 'T12:00:00'), 'MMM').toUpperCase()}</div>
                <div style={{ fontFamily: T.display, fontSize: '1.2rem', color: T.ink, lineHeight: 1 }}>{format(new Date(ev.event_date + 'T12:00:00'), 'd')}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.body, fontSize: '0.82rem', color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                <div style={{ fontFamily: T.mono, fontSize: '10px', color: T.inkFaint }}>{ev.event_time ?? ''}</div>
              </div>
            </div>
          )) : <div style={{ padding: '2rem', textAlign: 'center', color: T.inkFaint, fontStyle: 'italic', fontSize: '0.85rem' }}>No upcoming events.</div>}
        </div>

        {/* Attendance heatmap */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.1rem 1.25rem' }}>
          <div style={{ fontFamily: T.display, fontSize: '0.9rem', fontWeight: 600, color: T.ink, marginBottom: '1rem' }}>Attendance Overview ({new Date().getFullYear()})</div>
          <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(12, 1fr)', gap: '3px', fontSize: '9px' }}>
            <div />
            {Array.from({ length: 12 }, (_, m) => (
              <div key={m} style={{ fontFamily: T.mono, color: T.inkFaint, textAlign: 'center' }}>{monthLabel(m)[0]}</div>
            ))}
            {HEATMAP_ROWS.map(row => (
              <div key={row.label} style={{ display: 'contents' }}>
                <div style={{ fontFamily: T.mono, color: T.inkFaint, fontSize: '9px', alignSelf: 'center' }}>{row.label}</div>
                {heatmapData[row.label].map((present, m) => (
                  <div key={m} title={`${row.label} · ${monthLabel(m)}`} style={{ aspectRatio: '1', borderRadius: '2px', background: present ? T.gold : 'rgba(255,255,255,0.05)' }} />
                ))}
              </div>
            ))}
            <div style={{ display: 'contents' }}>
              <div style={{ fontFamily: T.mono, color: T.inkFaint, fontSize: '9px', alignSelf: 'center' }}>Mem.</div>
              {memberMonthCounts.map((count, m) => {
                const intensity = count / maxMemberCount
                return <div key={m} title={`${count} members present in ${monthLabel(m)}`} style={{ aspectRatio: '1', borderRadius: '2px', background: count === 0 ? 'rgba(255,255,255,0.05)' : `rgba(201,168,76,${0.25 + intensity * 0.65})` }} />
              })}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px', fontFamily: T.mono, fontSize: '9px', color: T.inkFaint }}>
            <span>Less</span>
            {[0.1, 0.35, 0.6, 0.9].map(o => <div key={o} style={{ width: '10px', height: '10px', borderRadius: '2px', background: `rgba(201,168,76,${o})` }} />)}
            <span>More</span>
          </div>
        </div>

        {/* Recent activity */}
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}`, fontFamily: T.display, fontSize: '0.9rem', fontWeight: 600, color: T.ink }}>
            Recent Activity
          </div>
          {activity.length > 0 ? activity.map((item, i) => {
            const tone = pillTone(item.tone)
            return (
              <div key={item.id} style={{ padding: '0.8rem 1.25rem', borderBottom: i < activity.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', gap: '10px' }}>
                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: tone.bg, border: `1px solid ${tone.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: tone.text, flexShrink: 0 }}>{item.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.body, fontSize: '0.78rem', color: T.ink }}>{item.text}</div>
                  <div title={format(new Date(item.at), 'MMM d, yyyy · h:mm a')} style={{ fontFamily: T.mono, fontSize: '9.5px', color: T.inkFainter, marginTop: '2px' }}>
                    {formatDistanceToNow(new Date(item.at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            )
          }) : <div style={{ padding: '2rem', textAlign: 'center', color: T.inkFaint, fontStyle: 'italic', fontSize: '0.85rem' }}>No recent activity.</div>}
=======
  ])

  const typeColor: Record<string, string> = { degree: 'pill-fc', grand_lodge: 'pill-mm', stated_communication: 'pill-ea', social: 'pill-active', other: 'pill-new' }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          {tenant.name} <span style={{ color: '#C9A84C' }}>#{tenant.number}</span>
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>{tenant.city ? `${tenant.city}, ${tenant.state}` : 'Lodge Admin Dashboard'} · {tenant.plan} plan</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '2rem' }}>
        {[
          { label: 'Active Brothers', value: memberCount ?? 0, color: '#5DBE85', note: 'In good standing' },
          { label: 'New Petitions', value: petitionCount ?? 0, color: '#C9A84C', note: 'Awaiting review', href: `/lodge/${params.slug}/petitions` },
          { label: 'Dues Outstanding', value: dueCount ?? 0, color: '#E74C3C', note: 'Brothers with balance', href: `/lodge/${params.slug}/dues` },
          { label: 'Annual Dues', value: `$${tenant.dues_amount}`, color: '#7BB8D4', note: 'Per brother per year' },
        ].map(({ label, value, color, note, href }) => (
          <div key={label} style={{ background: '#141C2E', padding: '1.4rem' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>{label}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', fontWeight: 700, color: '#F5F0E8', lineHeight: 1, marginBottom: '0.25rem' }}>{value}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color }}>{note}</div>
            {href && <Link href={href} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#C9A84C', textDecoration: 'none', letterSpacing: '0.08em', display: 'block', marginTop: '4px' }}>View →</Link>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Events */}
        <div className="data-box">
          <div className="data-box-head">
            <span>Upcoming Events</span>
            <Link href={`/lodge/${params.slug}/events`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>Manage →</Link>
          </div>
          {events && events.length > 0 ? events.map((ev: any, i: number) => (
            <div key={ev.id} style={{ padding: '0.85rem 1.4rem', borderBottom: i < events.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8', marginBottom: '2px' }}>{ev.title}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{format(new Date(ev.event_date + 'T12:00:00'), 'MMM d, yyyy')}</div>
              </div>
              <span className={`pill ${typeColor[ev.event_type] ?? 'pill-new'}`}>{ev.event_type.replace('_', ' ')}</span>
            </div>
          )) : <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>No upcoming events.</div>}
        </div>

        {/* Recent payments */}
        <div className="data-box">
          <div className="data-box-head">
            <span>Recent Payments</span>
            <Link href={`/lodge/${params.slug}/dues`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>View all →</Link>
          </div>
          {recentPayments && recentPayments.length > 0 ? recentPayments.map((p: any, i: number) => (
            <div key={p.id} style={{ padding: '0.85rem 1.4rem', borderBottom: i < recentPayments.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8', marginBottom: '2px' }}>
                  {p.profiles ? `Bro. ${p.profiles.first_name} ${p.profiles.last_name}` : 'Unknown'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{format(new Date(p.created_at), 'MMM d, yyyy')}</div>
              </div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: '#5DBE85', fontWeight: 700 }}>${p.amount}</div>
            </div>
          )) : <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>No payments yet.</div>}
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
        </div>
      </div>

      {/* Quick actions */}
<<<<<<< HEAD
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        {[
          { icon: '👥', label: 'Record Attendance', href: `/lodge/${params.slug}/attendance` },
          { icon: '$', label: 'Record Payment', href: `/lodge/${params.slug}/dues` },
          { icon: '📅', label: 'Create Meeting', href: `/lodge/${params.slug}/events` },
          { icon: '+', label: 'Add Candidate', href: `/lodge/${params.slug}/petitions` },
          { icon: '📖', label: 'Lodge Minutes', href: `/lodge/${params.slug}/documents` },
          { icon: '📊', label: 'View Reports', href: `/lodge/${params.slug}/reports` },
        ].map(qa => (
          <Link key={qa.label} href={qa.href} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.1rem', textAlign: 'center', textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: T.goldDim, border: `1px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: T.gold }}>{qa.icon}</div>
            <span style={{ fontFamily: T.body, fontSize: '0.75rem', color: T.ink }}>{qa.label}</span>
=======
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)' }}>
        {[
          { label: '+ Add Member', desc: 'Register a new brother', href: `/lodge/${params.slug}/members` },
          { label: '+ Create Event', desc: 'Schedule a lodge meeting', href: `/lodge/${params.slug}/events` },
          { label: '✉ Send Notice', desc: 'Communicate with brothers', href: `/lodge/${params.slug}/communications` },
          { label: '⚙ Settings', desc: 'Configure your lodge', href: `/lodge/${params.slug}/settings` },
        ].map(({ label, desc, href }) => (
          <Link key={label} href={href} style={{ background: '#141C2E', padding: '1.4rem', textDecoration: 'none', display: 'block', transition: 'background 0.2s' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#C9A84C', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '0.82rem', color: '#B8B0A0' }}>{desc}</div>
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
          </Link>
        ))}
      </div>
    </div>
  )
}
