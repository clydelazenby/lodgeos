

import { createClient } from '@/lib/supabase/server'
import { getTenantBySlug, getSessionUser, getProfile, getMembership } from '@/lib/supabase/queries'
import { can } from '@/lib/auth/permissions'
import { loadOverrides, viewerCapabilities } from '@/lib/auth/capabilities'
import { notFound } from 'next/navigation'
import { MemberProfileTabs } from '@/components/lodge/MemberProfileTabs'

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string; memberId: string }
  /** A link from the Assignments board arrives as ?tab=Tasks. */
  searchParams?: { tab?: string }
}) {
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
  //
  // Read through viewerCapabilities so a brother given 'finance' or
  // 'roster' as a personal exception (migration 035) sees the controls
  // the server will actually let him use. Reading tenant_role alone
  // here would show him the tier's answer while the route gave him a
  // different one.
  const viewerRole = (viewerMembership as any)?.tenant_role ?? null
  const viewerIsSuperAdmin = viewerProfile?.platform_role === 'super_admin'
  const viewerCaps = await viewerCapabilities(tenant.id, viewer?.id, viewerRole, viewerIsSuperAdmin)

  const canCharge = viewerCaps.allow('finance')

  // The register is the Secretary's book, and the same 'roster'
  // capability that /api/members/dates and the degree half of
  // /api/members/permissions enforce. Those routes are the authority —
  // this only decides whether the inputs render or the dates show as
  // text.
  const canEditDates = viewerCaps.allow('roster')

  /**
   * Setting a brother's tier or his exceptions is a FIXED tier check —
   * admin, secretary, grand master — matching can_set_permissions() in
   * migration 035 and the guard in /api/members/permissions. It is
   * deliberately not delegable through the exception system: a granted
   * 'settings' would otherwise widen the gate that issued it.
   */
  const canSetPermissions =
    viewerIsSuperAdmin || ['admin', 'secretary', 'grand_master'].includes(viewerRole ?? '')

  const [targetOverrides, targetProfile] = await Promise.all([
    loadOverrides(tenant.id, params.memberId),
    getProfile(params.memberId),
  ])

  const [{ data: attendanceHistory }, { data: paymentHistory }, { data: degreeHistory }, { data: charges }, { data: assignments }, { data: signedOff }] = await Promise.all([
    supabase.from('attendance').select('status, lodge_events(id, title, event_date)').eq('tenant_id', tenant.id).eq('member_id', params.memberId).order('lodge_events(event_date)', { ascending: false }),
    supabase.from('payments').select('*').eq('tenant_id', tenant.id).eq('member_id', params.memberId).eq('status', 'succeeded').order('created_at', { ascending: false }),
    supabase.from('degree_progress').select('*').eq('tenant_id', tenant.id).eq('member_id', params.memberId).order('degree'),
    supabase.from('member_charges').select('*').eq('tenant_id', tenant.id).eq('member_id', params.memberId).order('created_at', { ascending: false }),
    // What the lodge has asked of THIS brother, and — separately — the
    // curriculum steps he has been signed off on, because a degree
    // assignment's completion lives there rather than on the assignment
    // row. See lib/assignments.ts.
    supabase.from('assignments').select('id, title, description, due_date, step_id, document_id, completed_at, cancelled_at, assigned_by_name, created_at').eq('tenant_id', tenant.id).eq('assigned_to', params.memberId).order('created_at', { ascending: false }),
    supabase.from('curriculum_progress').select('step_id').eq('tenant_id', tenant.id).eq('member_id', params.memberId),
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
      assignments={assignments ?? []}
      signedOffStepIds={(signedOff ?? []).map((r: any) => r.step_id)}
      initialTab={searchParams?.tab}
      capabilityOverrides={targetOverrides}
      canSetPermissions={canSetPermissions}
      viewerIsSelf={!!viewer && viewer.id === params.memberId}
      targetIsPlatformAdmin={targetProfile?.platform_role === 'super_admin'}
    />
  )
}
