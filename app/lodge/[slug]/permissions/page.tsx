import { redirect, notFound } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { PermissionsBoard } from '@/components/lodge/PermissionsBoard'
import { stationRank } from '@/lib/stations'
import type { CapabilityOverrides } from '@/lib/auth/permissions'

/**
 * The lodge's table of authority.
 *
 * READABLE BY EVERY OFFICER, editable by the administrative office
 * alone. Who may do what is not a secret kept from the men it governs —
 * a Deacon should be able to see that the library belongs to his chair
 * without asking — and a page that hid it would only get screenshotted
 * and passed around anyway.
 *
 * Editing is the same fixed tier check as the routes behind it:
 * admin, secretary, grand master. Deliberately NOT the 'settings'
 * capability, because a lodge that could grant its way into this screen
 * could grant its way into everything else from here.
 */
export default async function PermissionsPage({ params }: { params: { slug: string } }) {
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
  if (!isSuperAdmin && (!role || role === 'member')) {
    redirect(`/lodge/${params.slug}/dashboard`)
  }

  const canEdit = isSuperAdmin || ['admin', 'secretary', 'grand_master'].includes(role)

  const supabase = await createClient()
  const [{ data: officeRows }, { data: memberRows }, { data: memberCaps }] = await Promise.all([
    supabase
      .from('position_capabilities')
      .select('lodge_role, capability, granted')
      .eq('tenant_id', tenant.id),
    supabase
      .from('tenant_members')
      .select('user_id, tenant_role, lodge_role, profiles(first_name, last_name, platform_role)')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
    supabase
      .from('member_capabilities')
      .select('member_id, capability, granted')
      .eq('tenant_id', tenant.id),
  ])

  const offices: Record<string, CapabilityOverrides> = {}
  for (const row of officeRows ?? []) {
    const r = row as any
    offices[r.lodge_role] = { ...(offices[r.lodge_role] ?? {}), [r.capability]: r.granted }
  }

  const byMember: Record<string, CapabilityOverrides> = {}
  for (const row of memberCaps ?? []) {
    const r = row as any
    byMember[r.member_id] = { ...(byMember[r.member_id] ?? {}), [r.capability]: r.granted }
  }

  // Officers in station order, then everyone else — the order a lodge
  // reads its own roll in, not alphabetical and not by signup date.
  const members = (memberRows ?? [])
    .map((m: any) => ({
      userId: m.user_id,
      name: `${m.profiles?.first_name ?? ''} ${m.profiles?.last_name ?? ''}`.trim() || 'Unnamed brother',
      tenantRole: m.tenant_role,
      lodgeRole: m.lodge_role,
      memberOverrides: byMember[m.user_id] ?? {},
      isPlatformAdmin: m.profiles?.platform_role === 'super_admin',
    }))
    .sort((a, b) => {
      const r = stationRank(a.lodgeRole) - stationRank(b.lodgeRole)
      return r !== 0 ? r : a.name.localeCompare(b.name)
    })

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ marginBottom: '1.6rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          THE LODGE
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Permissions
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          What each office carries, and what each brother can reach. Set it on the
          chair and it passes to next year&rsquo;s officer at the handover; set it on
          the man and it stays with him.
        </p>
      </div>

      <PermissionsBoard
        slug={params.slug}
        tenantId={tenant.id}
        offices={offices}
        members={members}
        canEdit={canEdit}
      />
    </div>
  )
}
