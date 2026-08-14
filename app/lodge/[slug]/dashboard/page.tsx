import { createClient } from '@/lib/supabase/server'
import { getTenantBySlug, getSessionUser, getProfile, getMembership } from '@/lib/supabase/queries'
import { DashboardGreeting } from '@/components/lodge/DashboardGreeting'
import { notFound } from 'next/navigation'
import { format, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { T, pillTone } from '@/lib/designTokens'
import { Users, DollarSign, CalendarPlus, UserPlus, BookOpen, BarChart3, ScrollText } from 'lucide-react'
import { upcomingSince } from '@/lib/dates'
import { anniversariesInMonth, anniversaryDay, serviceLabel } from '@/lib/anniversaries'

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

export default async function LodgeDashboardPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const today = upcomingSince()
  const yearStart = `${new Date().getFullYear()}-01-01`

  // Deduped against the identical lookup in lodge/[slug]/layout.tsx —
  // same render pass, so this costs no round trip.
  const tenant = await getTenantBySlug(params.slug)
  if (!tenant) notFound()

  // Who is reading this dashboard, for the greeting. All three helpers
  // are cache()-wrapped and were already called by the lodge layout in
  // this same render pass, so this costs no additional round trip.
  const viewer = await getSessionUser()
  const [viewerProfile, viewerMembership] = await Promise.all([
    viewer ? getProfile(viewer.id) : Promise.resolve(null),
    viewer ? getMembership(tenant.id, viewer.id) : Promise.resolve(null),
  ])

  // The chair this officer holds, for the duties tile below.
  const viewerOffice = ((viewerMembership as any)?.lodge_role ?? '').trim()

  const [
    { count: memberCount },
    { count: petitionCount },
    { count: dueCount },
    { data: events },
    { data: recentPayments },
    { data: allActiveMembers },
    { data: recentPetitions },
    { data: recentComms },
    { data: yearAttendance },
    { count: paidCount },
  ] = await Promise.all([
    supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_active', true),
    supabase.from('petitions').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'new'),
    supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('dues_status', 'due').eq('is_active', true),
    supabase.from('lodge_events').select('*').eq('tenant_id', tenant.id).gte('event_date', today).order('event_date').limit(4),
    // profiles!payments_member_id_fkey, not a bare profiles(...).
    // payments has TWO foreign keys to profiles — member_id, and
    // confirmed_by since migration 018 added dues-by-transfer — so
    // PostgREST cannot tell which one is meant and answers 300 Multiple
    // Choices. Supabase surfaces that as data: null with no thrown
    // error, so this panel has been silently empty ever since rather
    // than failing loudly. Naming the constraint is the whole fix.
    supabase.from('payments').select('*, profiles!payments_member_id_fkey(first_name, last_name)').eq('tenant_id', tenant.id).eq('status', 'succeeded').order('created_at', { ascending: false }).limit(5),
    supabase.from('tenant_members').select('user_id, lodge_role, raised_date, profiles(first_name, last_name)').eq('tenant_id', tenant.id).eq('is_active', true),
    supabase.from('petitions').select('id, first_name, last_name, created_at').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(4),
    supabase.from('communications').select('id, subject, created_at, is_draft').eq('tenant_id', tenant.id).eq('is_draft', false).order('created_at', { ascending: false }).limit(4),
    // Attendance joined through lodge_events for its date, filtered to
    // this calendar year — the attendance table itself has no month
    // column, only an event_id, so the month has to be derived from
    // the linked event's real event_date, not fabricated.
    supabase.from('attendance').select('member_id, status, lodge_events!inner(event_date)').eq('tenant_id', tenant.id).gte('lodge_events.event_date', yearStart),
    supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('dues_status', 'paid').eq('is_active', true),
  ])

  /**
   * WHOSE ANNIVERSARY FALLS THIS MONTH.
   *
   * The cron writes to the brother; this tells the LODGE, which is the
   * more important half. A fiftieth year is called in open lodge, and
   * the officers can only do that if they know before the meeting
   * rather than after it. Reuses the roster already fetched above, so
   * it costs one extra column and no extra query.
   */
  const anniversaries = anniversariesInMonth((allActiveMembers ?? []) as any, new Date())
    .sort((a, b) => anniversaryDay(a.raisedDate) - anniversaryDay(b.raisedDate))

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
      id: `com-${c.id}`, at: c.created_at, icon: '›', tone: 'info',
      text: `Notice sent: "${c.subject}"`,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 6)

  const kpis = [
    { icon: '◈', label: 'Total Members', value: memberCount ?? 0, sub: 'Active Members', tone: 'gold' as const },
    { icon: '$', label: 'Dues Collection', value: `${duesCollectedPct}%`, sub: 'Collected this year', tone: 'gold' as const, bar: duesCollectedPct },
    { icon: '◇', label: 'New Petitions', value: petitionCount ?? 0, sub: 'Awaiting review', tone: 'gold' as const, href: `/lodge/${params.slug}/petitions` },
    { icon: '▲', label: 'Dues Outstanding', value: dueCount ?? 0, sub: 'Brothers with balance', tone: 'danger' as const, href: `/lodge/${params.slug}/dues` },
  ]

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      <DashboardGreeting
        firstName={viewerProfile?.first_name ?? null}
        lastName={viewerProfile?.last_name ?? null}
        avatarUrl={viewerProfile?.avatar_url ?? null}
        lodgeRole={(viewerMembership as any)?.lodge_role ?? null}
        tenantRole={(viewerMembership as any)?.tenant_role ?? null}
        lodgeName={tenant.name}
        lodgeNumber={tenant.number}
        tenantId={tenant.id}
        slug={params.slug}
        subline={tenant.city ? `${tenant.city}, ${tenant.state}` : 'Lodge Admin Dashboard'}
      />

      {/* YEARS OF SERVICE FALLING THIS MONTH.
          High on the page, above the numbers, because it is the one
          item here with a deadline attached: it has to be read BEFORE
          the meeting, and a fiftieth year called a month late is worse
          than not calling it. Absent entirely when there are none —
          an empty "no anniversaries" card every month for eleven
          months would train officers to stop looking at the twelfth. */}
      {anniversaries.length > 0 && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.gold}33`, borderRadius: T.radius, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.14em', color: T.gold, textTransform: 'uppercase', marginBottom: '0.9rem' }}>
            Years of Service This Month
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {anniversaries.map((a) => (
              <div key={a.memberId} style={{ display: 'flex', alignItems: 'baseline', gap: '0.8rem', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: T.mono, fontSize: '0.62rem', color: T.inkFaint, minWidth: 28 }}>
                  {anniversaryDay(a.raisedDate)}
                </span>
                <span style={{ fontFamily: T.display, fontSize: '0.95rem', color: T.ink, flex: 1, minWidth: 160 }}>
                  {a.name}
                </span>
                <span
                  className={`pill ${a.milestone ? 'pill-fc' : 'pill-new'}`}
                  title={a.milestone ? 'A milestone year — worth calling in open lodge' : undefined}
                >
                  {serviceLabel(a.years)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontFamily: T.body, fontSize: '0.82rem', color: T.inkFaint, fontStyle: 'italic', marginTop: '0.9rem' }}>
            Each brother is also written to once, in the month it falls. Milestone years are marked
            in gold.
          </div>
        </div>
      )}

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
          {/* Exempt from the mobile grid collapse: a 12-month heatmap
              flattened to one column would be 78 stacked squares with no
              shape to read. It keeps its 13 tracks and scrolls sideways
              instead, with a min-width so the cells stay tappable rather
              than compressing to slivers. */}
          <div className="lodgeos-keep-grid-scroll">
          <div className="lodgeos-keep-grid" style={{ display: 'grid', gridTemplateColumns: '44px repeat(12, 1fr)', gap: '3px', fontSize: '9px', minWidth: '320px' }}>
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
        </div>
      </div>

      {/* Quick actions.
          These previously mixed full-colour emoji (👥 📅 📖 📊) with two
          bare typographic characters ($ and +) inside the same gold
          badge. Emoji render in their own fixed palette, so four of the
          six tiles were multicolour blobs against a strictly navy/gold
          interface, and the other two were plain glyphs at a different
          optical weight — six badges, three different visual languages.
          lucide-react (already a dependency, used on the public page)
          gives one consistent stroked set that inherits currentColor,
          so every badge is the same gold as everything else.
          Also switched from a horizontal row to a 2-up grid on phones,
          where six 150px tiles previously stacked into a long column. */}
      <div className="lodgeos-quick-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        {[
          { Icon: Users, label: 'Record Attendance', href: `/lodge/${params.slug}/attendance` },
          { Icon: DollarSign, label: 'Record Payment', href: `/lodge/${params.slug}/dues` },
          { Icon: CalendarPlus, label: 'Create Meeting', href: `/lodge/${params.slug}/events` },
          { Icon: UserPlus, label: 'Add Candidate', href: `/lodge/${params.slug}/petitions` },
          { Icon: BookOpen, label: 'Lodge Minutes', href: `/lodge/${params.slug}/documents` },
          { Icon: BarChart3, label: 'View Reports', href: `/lodge/${params.slug}/reports` },
          /**
           * HIS OWN CHAIR FIRST, if he holds one.
           *
           * An officer opening the dashboard and wondering what he is
           * responsible for should not have to know the page is called
           * "Officer Duties" and lives under Lodge. The tile names his
           * office back to him and opens straight to it; a brother with
           * no chair gets the whole list, which is what he would want
           * before accepting one.
           */
          {
            Icon: ScrollText,
            label: viewerOffice ? `My Duties · ${viewerOffice}` : 'Officer Duties',
            href: viewerOffice
              ? `/lodge/${params.slug}/duties?office=${encodeURIComponent(viewerOffice)}`
              : `/lodge/${params.slug}/duties`,
          },
        ].map(({ Icon, label, href }) => (
          <Link
            key={label}
            href={href}
            className="lodgeos-quick-action"
            style={{
              background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius,
              padding: '1.1rem 0.75rem', textAlign: 'center', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '10px', minHeight: '96px',
            }}
          >
            <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: T.goldDim, border: `1px solid ${T.goldBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.gold, flexShrink: 0 }}>
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span style={{ fontFamily: T.body, fontSize: '0.75rem', color: T.ink, lineHeight: 1.3 }}>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
