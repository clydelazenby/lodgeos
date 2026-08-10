import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { MinutesEditor } from '@/components/lodge/MinutesEditor'

/**
 * Writing up one meeting.
 *
 * Officer tier throughout — the same people who run a meeting write it
 * up. Approval is narrower and happens on the minute book page, because
 * it is an act of the lodge rather than of whoever had the document
 * open.
 */
export default async function WriteMinutesPage({
  params,
}: {
  params: { slug: string; eventId: string }
}) {
  const [user, tenant] = await Promise.all([getSessionUser(), getTenantBySlug(params.slug)])

  if (!user) redirect('/auth/login')
  if (!tenant) notFound()

  const [membership, profile] = await Promise.all([
    getMembership(tenant.id, user.id),
    getProfile(user.id),
  ])

  const isSuperAdmin = profile?.platform_role === 'super_admin'
  if (!membership && !isSuperAdmin) redirect('/auth/login')
  if (membership && (membership as any).tenant_role === 'member') redirect('/portal')

  const supabase = await createClient()

  const { data: event } = await supabase
    .from('lodge_events')
    .select('id, title, event_date')
    .eq('id', params.eventId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  if (!event) notFound()

  const [{ data: minutes }, { data: attendance }, { data: visitors }] = await Promise.all([
    supabase
      .from('meeting_minutes')
      .select('id, body, status')
      .eq('tenant_id', tenant.id)
      .eq('event_id', params.eventId)
      .maybeSingle(),
    supabase
      .from('attendance')
      .select('status')
      .eq('tenant_id', tenant.id)
      .eq('event_id', params.eventId),
    supabase
      .from('event_visitors')
      .select('name, visiting_from')
      .eq('tenant_id', tenant.id)
      .eq('event_id', params.eventId)
      .order('created_at'),
  ])

  const rows = attendance ?? []
  const summary = {
    present: rows.filter((a: any) => a.status === 'present').length,
    absent: rows.filter((a: any) => a.status === 'absent').length,
    excused: rows.filter((a: any) => a.status === 'excused').length,
  }

  return (
    <div>
      <div style={{ marginBottom: '1.6rem' }}>
        <Link
          href={`/lodge/${params.slug}/minutes`}
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.1em', color: '#B8B0A0', textDecoration: 'none' }}
        >
          ← THE MINUTE BOOK
        </Link>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.5rem', color: '#F5F0E8', margin: '0.6rem 0 0.25rem' }}>
          {(event as any).title}
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          {new Date((event as any).event_date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      <MinutesEditor
        tenantId={tenant.id}
        eventId={params.eventId}
        slug={params.slug}
        event={{ title: (event as any).title, event_date: (event as any).event_date }}
        initial={(minutes as any) ?? null}
        attendanceSummary={summary}
        visitors={(visitors ?? []) as any}
      />
    </div>
  )
}
