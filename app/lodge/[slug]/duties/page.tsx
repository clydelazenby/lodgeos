import { redirect, notFound } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { DutiesBoard } from '@/components/lodge/DutiesBoard'
import { DUTY_OFFICES, canEditDuties } from '@/lib/duties'

/**
 * What each office is responsible for.
 *
 * OPEN TO EVERY BROTHER — no `need` on the nav entry and no capability
 * check here. Who does what in a lodge is not officers' business kept
 * from the craft, and the man most in need of this page is the one who
 * has just been appointed and has the least access.
 *
 * Editing is the administrative tier plus the Master's and the Senior
 * Warden's chairs, re-checked in /api/duties, which is the authority.
 */
export default async function DutiesPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  /** ?office=Senior+Warden opens and scrolls to one chair. */
  searchParams?: { office?: string }
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

  const canEdit = canEditDuties(
    (membership as any)?.tenant_role,
    (membership as any)?.lodge_role,
    isSuperAdmin
  )

  const supabase = await createClient()
  const [{ data: written }, { data: memberRows }] = await Promise.all([
    supabase
      .from('office_duties')
      .select('lodge_role, duties, updated_by_name')
      .eq('tenant_id', tenant.id),
    supabase
      .from('tenant_members')
      .select('lodge_role, profiles(first_name, last_name)')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
  ])

  const custom: Record<string, { duties: string; updatedByName: string | null }> = {}
  for (const row of written ?? []) {
    const r = row as any
    custom[r.lodge_role] = { duties: r.duties, updatedByName: r.updated_by_name }
  }

  const holders: Record<string, string[]> = {}
  for (const m of (memberRows ?? []) as any[]) {
    const office = (m.lodge_role ?? '').trim()
    if (!office) continue
    const name = `${m.profiles?.first_name ?? ''} ${m.profiles?.last_name ?? ''}`.trim()
    if (name) holders[office] = [...(holders[office] ?? []), name]
  }

  /**
   * The canonical list, plus any office this lodge has actually filled
   * or written about. An office a lodge invented must not be the one
   * office with no description.
   */
  const offices = Array.from(new Set([
    ...DUTY_OFFICES,
    ...Object.keys(custom),
    ...Object.keys(holders),
  ]))

  const duties = offices.map(office => ({
    lodgeRole: office,
    custom: custom[office]?.duties ?? null,
    updatedByName: custom[office]?.updatedByName ?? null,
    holders: holders[office] ?? [],
  }))

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: '1.6rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          THE LODGE
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Duties of the Officers
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          What each chair is responsible for, and who is sitting in it. A brother appointed in
          December should be able to read what he has agreed to do without having to ask.
        </p>
      </div>

      <DutiesBoard
        tenantId={tenant.id}
        slug={params.slug}
        duties={duties}
        canEdit={canEdit}
        openOffice={searchParams?.office}
      />
    </div>
  )
}
