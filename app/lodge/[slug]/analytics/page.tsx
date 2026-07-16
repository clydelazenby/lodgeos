import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { AnalyticsCharts } from '@/components/lodge/AnalyticsCharts'

const monthLabel = (m: number) => new Date(2000, m, 1).toLocaleString('en-US', { month: 'short' })

export default async function LodgeAnalyticsPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: tenant } = await supabase.from('tenants').select('*').eq('slug', params.slug).single()
  if (!tenant) notFound()

  const yearStart = `${new Date().getFullYear()}-01-01`

  const [
    { data: yearAttendance },
    { data: yearPayments },
    { data: activeMembers },
  ] = await Promise.all([
    supabase.from('attendance').select('status, lodge_events!inner(event_date)').eq('tenant_id', tenant.id).eq('status', 'present').gte('lodge_events.event_date', yearStart),
    supabase.from('payments').select('amount, created_at').eq('tenant_id', tenant.id).eq('status', 'succeeded').gte('created_at', yearStart),
    supabase.from('tenant_members').select('degree, profiles(date_of_birth)').eq('tenant_id', tenant.id).eq('is_active', true),
  ])

  // Attendance trend: count of present records per month, joined
  // through the real event date — same pattern as the Dashboard
  // heatmap, just summed across all members instead of per-officer.
  const attendanceByMonth = new Array(12).fill(0)
  for (const a of yearAttendance ?? []) {
    const eventDate = (a as any).lodge_events?.event_date
    if (eventDate) attendanceByMonth[new Date(eventDate + 'T12:00:00').getMonth()]++
  }

  // Dues collection trend: real payment amounts bucketed by the month
  // they were actually paid.
  const duesByMonth = new Array(12).fill(0)
  for (const p of yearPayments ?? []) {
    duesByMonth[new Date(p.created_at).getMonth()] += Number(p.amount)
  }

  const trendData = Array.from({ length: 12 }, (_, m) => ({
    month: monthLabel(m), attendance: attendanceByMonth[m], dues: duesByMonth[m],
  }))

  // Degree pipeline: real counts by degree, ordered EA -> FC -> MM to
  // read as a funnel (fewer members at each more-advanced stage is the
  // expected, honest shape — not manufactured to look a certain way).
  const degreeCounts = { EA: 0, FC: 0, MM: 0 }
  for (const m of activeMembers ?? []) {
    const d = (m as any).degree as keyof typeof degreeCounts
    if (d in degreeCounts) degreeCounts[d]++
  }
  const pipelineData = [
    { stage: 'Entered Apprentice', count: degreeCounts.EA },
    { stage: 'Fellowcraft', count: degreeCounts.FC },
    { stage: 'Master Mason', count: degreeCounts.MM },
  ]

  // Demographics: age bands computed from real date_of_birth where
  // present. date_of_birth is optional (migration 006) — many existing
  // members may not have it set, so this explicitly separates "known
  // age" members from "unknown," rather than silently excluding them
  // and making the chart look more complete than the underlying data is.
  const bands = { 'Under 40': 0, '40–60': 0, 'Over 60': 0 }
  let unknownAge = 0
  const now = new Date()
  for (const m of activeMembers ?? []) {
    const dob = (m as any).profiles?.date_of_birth
    if (!dob) { unknownAge++; continue }
    const age = now.getFullYear() - new Date(dob).getFullYear()
    if (age < 40) bands['Under 40']++
    else if (age <= 60) bands['40–60']++
    else bands['Over 60']++
  }
  const demographicsData = Object.entries(bands).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  const totalKnownAge = Object.values(bands).reduce((a, b) => a + b, 0)

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: T.display, fontSize: '1.5rem', color: T.ink, margin: 0 }}>Analytics</h1>
        <p style={{ fontFamily: T.body, color: T.inkFaint, fontSize: '0.85rem', margin: '4px 0 0' }}>{tenant.name} #{tenant.number} · {new Date().getFullYear()}</p>
      </div>

      <AnalyticsCharts
        trendData={trendData}
        pipelineData={pipelineData}
        demographicsData={demographicsData}
        totalKnownAge={totalKnownAge}
        unknownAge={unknownAge}
      />
    </div>
  )
}
