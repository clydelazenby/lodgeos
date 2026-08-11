import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DutiesBoard } from '@/components/lodge/DutiesBoard'
import { DUTY_OFFICES, canEditDuties } from '@/lib/duties'

/**
 * The duties of the officers, for every brother.
 *
 * THIS PAGE EXISTS BECAUSE THE LODGE-SIDE ONE IS UNREACHABLE FOR MOST
 * OF THE LODGE. /lodge/[slug]/duties was written as "open to every
 * brother" and given no capability gate — but the lodge LAYOUT above
 * it redirects the plain member tier straight to the portal, so half
 * the roster could never get to it. The page was open and the door
 * was locked.
 *
 * The men who most need to read what a chair involves are the ones
 * who have not held one: a brother wondering what the Junior Steward
 * does before he says yes to it. So it lives here too, where every
 * brother actually is.
 *
 * Read-only. Rewriting stays with the administrative tier and the two
 * senior chairs, on the lodge side and in /api/duties.
 */
export default async function PortalDutiesPage({
  searchParams,
}: {
  searchParams?: { office?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id, tenant_role, lodge_role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!membership) redirect('/onboarding/setup')
  const tenantId = (membership as any).tenant_id

  const [{ data: tenant }, { data: written }, { data: memberRows }] = await Promise.all([
    supabase.from('tenants').select('slug, name, number').eq('id', tenantId).single(),
    supabase.from('office_duties').select('lodge_role, duties, updated_by_name').eq('tenant_id', tenantId),
    supabase
      .from('tenant_members')
      .select('lodge_role, profiles(first_name, last_name)')
      .eq('tenant_id', tenantId)
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

  const mine = ((membership as any).lodge_role ?? '').trim()

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          THE LODGE
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Duties of the Officers
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          {mine
            ? `What every chair in the lodge is responsible for — yours first.`
            : `What every chair in the lodge is responsible for, and who is sitting in it.`}
        </p>
      </div>

      <DutiesBoard
        tenantId={tenantId}
        slug={(tenant as any)?.slug ?? ''}
        duties={duties}
        // Read-only here whatever his tier: the editing controls live
        // on the lodge side, and /api/duties refuses anyone else anyway.
        canEdit={false}
        showPermissionsLink={false}
        // His own chair opens first — the question he came with.
        openOffice={searchParams?.office || mine || undefined}
      />
    </div>
  )
}
