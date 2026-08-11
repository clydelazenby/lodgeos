import { notFound, redirect } from 'next/navigation'
import { getSessionUser, getTenantBySlug, getMembership, getProfile } from '@/lib/supabase/queries'
import { loadOverrides } from '@/lib/auth/capabilities'
import { createClient } from '@/lib/supabase/server'
import { can, canWithTiers } from '@/lib/auth/permissions'
import { auditActionLabel } from '@/lib/audit'

/**
 * The audit trail.
 *
 * Read-only, and there is no way to make it anything else — the table
 * carries select and insert policies and no update or delete policy at
 * all, so with RLS on there is no API path that alters a row. An audit
 * trail that can be edited is not one.
 *
 * WHO SEES IT. Narrower than the rest of the lodge admin area. Since
 * migration 022, is_tenant_admin() means "holds administrative access
 * of some kind" and includes wardens and deacons; that is the right
 * breadth for attendance and degree work and the wrong breadth for a
 * ledger of everything the Treasurer has done. The RLS policy and this
 * page both restrict it to the administrative office — Secretary,
 * Master, Treasurer and above — and the database is the one that counts.
 *
 * A CAP, NOT A PAGER. Two hundred entries is roughly a year of a small
 * lodge's activity and fits in one screenful of scrolling. Paginating
 * would add controls to a page whose job is to be scanned when
 * something is in dispute; if a lodge ever outgrows it, the fix is a
 * date filter rather than a Next button.
 */
const MAX_ENTRIES = 200

export default async function LodgeAuditPage({ params }: { params: { slug: string } }) {
  const [user, tenant] = await Promise.all([getSessionUser(), getTenantBySlug(params.slug)])

  if (!user) redirect('/auth/login')
  if (!tenant) notFound()

  const [membership, profile] = await Promise.all([
    getMembership(tenant.id, user.id),
    getProfile(user.id),
  ])

  const isSuperAdmin = profile?.platform_role === 'super_admin'
  if (!membership && !isSuperAdmin) redirect('/auth/login')

  // 'settings' is the capability held by exactly the tiers that should
  // read this: admin, secretary and grand_master, plus super admins.
  // The Treasurer is added because his own entries are the ones most
  // often being asked about, and a man should be able to see the record
  // of what he did.
  const role = (membership as any)?.tenant_role ?? null
  //
  // Read through canWithTiers rather than an `|| role === ...` bolted on
  // outside the override check: the Treasurer and the Master belong on
  // the list, but a lodge that has explicitly denied one of them
  // 'settings' means it, and an `||` would quietly ignore that.
  const overrides = await loadOverrides(tenant.id, user.id)
  const allowed = canWithTiers(
    role, 'settings', isSuperAdmin, overrides,
    ['admin', 'secretary', 'grand_master', 'treasurer', 'worshipful_master']
  )
  if (!allowed) redirect(`/lodge/${params.slug}/dashboard`)

  const supabase = await createClient()
  const { data: entries } = await supabase
    .from('audit_log')
    .select('id, created_at, actor_name, action, summary, entity_type')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(MAX_ENTRIES)

  const rows = entries ?? []

  // Grouped by day. A flat list of timestamps is hard to scan, and the
  // question being asked of this page is nearly always anchored to a
  // day — "what happened at the November meeting".
  const byDay = new Map<string, typeof rows>()
  for (const row of rows) {
    const day = String((row as any).created_at).slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(row)
  }

  const dayLabel = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })

  const timeLabel = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>
          THE RECORD
        </div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Audit Trail
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0', margin: 0 }}>
          Who changed what, and when. Append-only — nothing here can be edited or removed, by
          anyone. Showing the most recent {MAX_ENTRIES}.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="data-box">
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>
            Nothing recorded yet. Entries appear here as officers make changes to the roster, dues,
            degrees and records from now on — the trail starts the day it was switched on and does
            not reach back over changes made before it.
          </div>
        </div>
      ) : (
        Array.from(byDay.entries()).map(([day, dayRows]) => (
          <div key={day} className="data-box">
            <div className="data-box-head">
              <span>{dayLabel(day)}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
                {dayRows.length}
              </span>
            </div>
            {dayRows.map((row: any) => (
              <div
                key={row.id}
                style={{
                  padding: '0.8rem 1.4rem',
                  borderBottom: '1px solid rgba(201,168,76,0.05)',
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', minWidth: 62 }}>
                  {timeLabel(row.created_at)}
                </span>
                <span style={{ flex: 1, minWidth: 220 }}>
                  <span style={{ display: 'block', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#E8E2D5' }}>
                    {row.summary}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#918879' }}>
                    {auditActionLabel(row.action).toUpperCase()}
                  </span>
                </span>
                {/* The name as it was when he acted, not as it is now —
                    see lib/audit.ts. An entry whose author has since
                    left the lodge must still say who made it. */}
                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.75rem', color: '#C9A84C', whiteSpace: 'nowrap' }}>
                  {row.actor_name || 'LodgeOS'}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
