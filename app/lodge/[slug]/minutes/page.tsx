import { notFound, redirect } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { MinuteBook } from '@/components/lodge/MinuteBook'

/**
 * The minute book.
 *
 * The lodge's principal record, which until now had nowhere to live in
 * this app at all: the AI Secretary would draft a set of minutes, the
 * Secretary copied them out, and they became a word processor file on
 * his laptop — unsearchable by anyone else and gone when he handed over
 * the office.
 *
 * Two lists, because the useful question is not only what was recorded
 * but what has NOT been. Meetings with nothing written appear first.
 */

// A minute book is consulted, not browsed. Two years covers every
// question anyone asks of it in practice, and search runs over what is
// loaded.
const MEETINGS_BACK = 40

export default async function LodgeMinutesPage({ params }: { params: { slug: string } }) {
  const [user, tenant] = await Promise.all([getSessionUser(), getTenantBySlug(params.slug)])

  if (!user) redirect('/auth/login')
  if (!tenant) notFound()

  const [membership, profile] = await Promise.all([
    getMembership(tenant.id, user.id),
    getProfile(user.id),
  ])

  const isSuperAdmin = profile?.platform_role === 'super_admin'
  if (!membership && !isSuperAdmin) redirect('/auth/login')

  const role = (membership as any)?.tenant_role ?? null

  // Approval is an act of the lodge, and someone must be answerable for
  // recording that it happened. Same tiers the route enforces.
  const canApprove =
    can(role, 'settings', isSuperAdmin) || role === 'worshipful_master'

  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: minutes }, { data: pastMeetings }] = await Promise.all([
    supabase
      .from('meeting_minutes')
      .select('id, event_id, body, status, approved_on, approved_by_name, correction_note, drafted_by_name, lodge_events(id, title, event_date)')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }),
    // Only meetings that have HAPPENED can want minutes. Offering to
    // write up next month's stated communication would be nonsense.
    supabase
      .from('lodge_events')
      .select('id, title, event_date')
      .eq('tenant_id', tenant.id)
      .lte('event_date', today)
      .order('event_date', { ascending: false })
      .limit(MEETINGS_BACK),
  ])

  const recorded = new Set((minutes ?? []).map((m: any) => m.event_id))
  const awaiting = (pastMeetings ?? []).filter((e: any) => !recorded.has(e.id))

  // Sorted by the meeting they record rather than when they were typed
  // up — a set written late still belongs in its own place in the book.
  const sorted = [...(minutes ?? [])].sort((a: any, b: any) =>
    String(b.lodge_events?.event_date ?? '').localeCompare(String(a.lodge_events?.event_date ?? ''))
  )

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          THE RECORD OF THE LODGE
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Minutes
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          Written after the meeting, read and approved at the next one. Approved minutes are the
          lodge&apos;s record and cannot be edited afterwards.
        </p>
      </div>

      <MinuteBook
        slug={params.slug}
        tenantId={tenant.id}
        minutes={sorted as any}
        meetingsWithoutMinutes={awaiting as any}
        canApprove={canApprove}
      />
    </div>
  )
}
