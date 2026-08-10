

import { createClient } from '@/lib/supabase/server'
import { getTenantBySlug, getSessionUser, getProfile, getMembership } from '@/lib/supabase/queries'
import { can } from '@/lib/auth/permissions'
import { notFound } from 'next/navigation'
import { MemberProfileTabs } from '@/components/lodge/MemberProfileTabs'

export default async function MemberDetailPage({ params }: { params: { slug: string; memberId: string } }) {
  const supabase = await createClient()
  // Deduped against the identical lookup in lodge/[slug]/layout.tsx —
  // same render pass, so this costs no round trip.
  const tenant = await getTenantBySlug(params.slug)
  if (!tenant) notFound()

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('*, profiles(*)')
    .eq('tenant_id', tenant.id)
    .eq('user_id', params.memberId)
    .single()

  if (!membership) notFound()

  // Who is looking, and may he levy a charge? The 'finance' capability
  // already covers the Treasurer and the Worshipful Master; this only
  // decides whether to render the form. /api/dues/charges re-checks it
  // and is the authority.
  const viewer = await getSessionUser()
  const [viewerProfile, viewerMembership] = await Promise.all([
    viewer ? getProfile(viewer.id) : Promise.resolve(null),
    viewer ? getMembership(tenant.id, viewer.id) : Promise.resolve(null),
  ])
  const canCharge = can(
    (viewerMembership as any)?.tenant_role ?? null,
    'finance',
    viewerProfile?.platform_role === 'super_admin'
  )

  // The register is the Secretary's book. 'roster' is exactly the
  // admin/secretary/grand_master set that /api/members/dates enforces,
  // and that route is the authority — this only decides whether the
  // inputs render or the dates show as text.
  const canEditDates = can(
    (viewerMembership as any)?.tenant_role ?? null,
    'roster',
    viewerProfile?.platform_role === 'super_admin'
  )

  const [{ data: attendanceHistory }, { data: paymentHistory }, { data: degreeHistory }, { data: charges }] = await Promise.all([
    supabase.from('attendance').select('status, lodge_events(id, title, event_date)').eq('tenant_id', tenant.id).eq('member_id', params.memberId).order('lodge_events(event_date)', { ascending: false }),
    supabase.from('payments').select('*').eq('tenant_id', tenant.id).eq('member_id', params.memberId).eq('status', 'succeeded').order('created_at', { ascending: false }),
    supabase.from('degree_progress').select('*').eq('tenant_id', tenant.id).eq('member_id', params.memberId).order('degree'),
    supabase.from('member_charges').select('*').eq('tenant_id', tenant.id).eq('member_id', params.memberId).order('created_at', { ascending: false }),
  ])

  return (
    <MemberProfileTabs
      slug={params.slug}
      tenant={tenant}
      membership={membership}
      attendanceHistory={attendanceHistory ?? []}
      paymentHistory={paymentHistory ?? []}
      degreeHistory={degreeHistory ?? []}
      charges={charges ?? []}
      canCharge={canCharge}
      canEditDates={canEditDates}
    />
  )
}
