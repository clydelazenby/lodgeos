import { notFound, redirect } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { AssignmentBoard } from '@/components/lodge/AssignmentBoard'

/**
 * Work given out by the lodge.
 *
 * The Master, the Secretary and the Wardens may assign — see the
 * 'assignments' capability, which records why both Wardens are included
 * rather than the Senior Warden alone. /api/assignments enforces the
 * same set and is the authority; this page only decides what renders.
 */
export default async function LodgeAssignmentsPage({ params }: { params: { slug: string } }) {
  const [user, tenant] = await Promise.all([getSessionUser(), getTenantBySlug(params.slug)])
  if (!user) redirect('/auth/login')
  if (!tenant) notFound()

  const [membership, profile] = await Promise.all([
    getMembership(tenant.id, user.id),
    getProfile(user.id),
  ])

  const isSuperAdmin = profile?.platform_role === 'super_admin'
  if (!membership && !isSuperAdmin) redirect('/auth/login')

  if (!can((membership as any)?.tenant_role ?? null, 'assignments', isSuperAdmin)) {
    redirect(`/lodge/${params.slug}/dashboard`)
  }

  const supabase = await createClient()

  const [{ data: members }, { data: assignments }, { data: signedOff }, { data: steps }, { data: docs }] =
    await Promise.all([
      supabase
        .from('tenant_members')
        .select('user_id, degree, profiles(first_name, last_name, email)')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true),
      supabase
        .from('assignments')
        .select('id, assigned_to, title, description, due_date, step_id, document_id, completed_at, cancelled_at, assigned_by_name, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false }),
      // Curriculum sign-offs, because a curriculum assignment's
      // completion lives there and not on the assignment row. See
      // lib/assignments.ts for why there is only one place for it.
      supabase
        .from('curriculum_progress')
        .select('member_id, step_id')
        .eq('tenant_id', tenant.id),
      supabase
        .from('curriculum_steps')
        .select('degree')
        .eq('tenant_id', tenant.id),
      supabase
        .from('documents')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .order('name'),
    ])

  const signedOffByMember: Record<string, string[]> = {}
  for (const row of signedOff ?? []) {
    const id = (row as any).member_id
    ;(signedOffByMember[id] ??= []).push((row as any).step_id)
  }

  const curriculumCounts: Record<string, number> = {}
  for (const s of steps ?? []) {
    const d = (s as any).degree
    curriculumCounts[d] = (curriculumCounts[d] ?? 0) + 1
  }

  const roster = (members ?? [])
    .map((m: any) => ({
      user_id: m.user_id,
      degree: m.degree,
      email: m.profiles?.email ?? null,
      name: `${m.profiles?.first_name ?? ''} ${m.profiles?.last_name ?? ''}`.trim() || 'Brother',
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      <div style={{ marginBottom: '1.8rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          WORK OF THE LODGE
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Assignments
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          Ask a brother to do something, or put a candidate on a whole degree plan. He is emailed
          once — not once per step — and sees it in his portal alongside what he has already done.
        </p>
      </div>

      <AssignmentBoard
        slug={params.slug}
        tenantId={tenant.id}
        members={roster}
        assignments={(assignments ?? []) as any}
        signedOffByMember={signedOffByMember}
        documents={(docs ?? []) as any}
        curriculumCounts={curriculumCounts}
      />
    </div>
  )
}
