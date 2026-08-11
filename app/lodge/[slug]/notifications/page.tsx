import { redirect, notFound } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import { createClient } from '@/lib/supabase/server'
import { NotificationsBoard } from '@/components/lodge/NotificationsBoard'
import { stationRank } from '@/lib/stations'
import type { RosterEvent } from '@/lib/notifications'

/**
 * Who hears when the roster changes.
 *
 * READABLE BY EVERY OFFICER, because "is anybody being told about this?"
 * is a question any of them may have — and because everyone can switch
 * his own off, which he cannot do on a page he cannot open. Changing
 * someone else's is the administrative office, checked again in the
 * route.
 */
export default async function NotificationsPage({ params }: { params: { slug: string } }) {
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

  const canEditOthers = isSuperAdmin || ['admin', 'secretary', 'grand_master'].includes(role)

  const supabase = await createClient()
  const [{ data: memberRows }, { data: prefRows }] = await Promise.all([
    supabase
      .from('tenant_members')
      .select('user_id, tenant_role, lodge_role, profiles(first_name, last_name, email)')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true),
    supabase
      .from('notification_preferences')
      .select('member_id, event_type, enabled')
      .eq('tenant_id', tenant.id),
  ])

  const byMember: Record<string, Partial<Record<RosterEvent, boolean>>> = {}
  for (const row of prefRows ?? []) {
    const r = row as any
    byMember[r.member_id] = { ...(byMember[r.member_id] ?? {}), [r.event_type]: r.enabled }
  }

  const members = (memberRows ?? [])
    .map((m: any) => ({
      userId: m.user_id,
      name: `${m.profiles?.first_name ?? ''} ${m.profiles?.last_name ?? ''}`.trim() || 'Unnamed brother',
      email: m.profiles?.email ?? null,
      tenantRole: m.tenant_role,
      lodgeRole: m.lodge_role,
      prefs: byMember[m.user_id] ?? {},
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
          Notifications
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          Who gets an email when a brother is invited, when he first signs in, and when he
          comes off the roster. The administrative office, the Worshipful Master and the
          Senior Deacon hear by default — and anyone can switch his own off.
        </p>
      </div>

      <NotificationsBoard
        tenantId={tenant.id}
        members={members}
        viewerId={user.id}
        canEditOthers={canEditOthers}
      />
    </div>
  )
}
