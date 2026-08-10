import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { degreeLabel, degreePillClass, degreeRank } from '@/lib/degrees'

/**
 * The lodge roster, as a brother sees it.
 *
 * The roster was officer-only, which is a strange place to draw the
 * line: knowing who your brethren are is not administration, it is the
 * ordinary business of belonging to a lodge. A printed roster has been
 * handed to every member of every lodge for two hundred years.
 *
 * NOTHING NEW IS EXPOSED AT THE DATABASE LEVEL. RLS has always let a
 * member read tenant_members and profiles for his own lodge ("Members
 * visible to lodge members", "Tenant members visible to lodge
 * members") — this page just gives him a page for what his session
 * could already fetch. It is READ ONLY; every write path stays behind
 * the officer guards it always had.
 *
 * What is deliberately NOT here, though the same query could carry it:
 * dues status and dues amounts. Whether a brother is behind on his
 * dues is between him, the Secretary and the Treasurer, and putting a
 * red "DUE" pill beside his name in front of the whole lodge would be
 * a small public shaming performed automatically every month.
 */
export default async function PortalRosterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: membership } = await supabase
    .from('tenant_members')
    .select('tenant_id, tenants(name, number)')
    .eq('user_id', user.id).eq('is_active', true).single()

  if (!membership) redirect('/auth/login')
  const tenant = (membership as any).tenants

  const { data: members } = await supabase
    .from('tenant_members')
    .select('id, user_id, degree, lodge_role, profiles(first_name, last_name, email, phone, avatar_url)')
    .eq('tenant_id', (membership as any).tenant_id)
    .eq('is_active', true)

  // Officers first, in station order where we know it, then everyone
  // else by surname — the order a printed roster uses.
  const STATION_ORDER = [
    'Worshipful Master', 'Senior Warden', 'Junior Warden', 'Treasurer', 'Secretary',
    'Chaplain', 'Senior Deacon', 'Junior Deacon', 'Senior Steward', 'Junior Steward',
    'Marshal', 'Tyler',
  ]
  const rank = (m: any) => {
    const i = STATION_ORDER.indexOf((m.lodge_role ?? '').trim())
    return i === -1 ? STATION_ORDER.length : i
  }
  const sorted = [...(members ?? [])].sort((a: any, b: any) => {
    const byStation = rank(a) - rank(b)
    if (byStation !== 0) return byStation
    const surname = (m: any) => (m.profiles?.last_name ?? '').toLowerCase()
    return surname(a).localeCompare(surname(b))
  })

  const officers = sorted.filter((m: any) => (m.lodge_role ?? '').trim())
  const brethren = sorted.filter((m: any) => !(m.lodge_role ?? '').trim())

  const Row = ({ m }: { m: any }) => {
    const name = `${m.profiles?.first_name ?? ''} ${m.profiles?.last_name ?? ''}`.trim() || 'Brother'
    const initials = `${m.profiles?.first_name?.[0] ?? ''}${m.profiles?.last_name?.[0] ?? ''}`.toUpperCase() || '?'
    return (
      <div style={{ padding: '0.85rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', alignItems: 'center', gap: '0.9rem', flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {m.profiles?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded Storage URL
            <img src={m.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.8rem', color: '#C9A84C' }}>{initials}</span>
          )}
        </div>

        <div style={{ minWidth: 160, flex: 1 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: '#F5F0E8' }}>{name}</div>
          {m.lodge_role && (
            <div style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.85rem', color: '#C9A84C' }}>{m.lodge_role}</div>
          )}
          {(m.profiles?.email || m.profiles?.phone) && (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', marginTop: 3 }}>
              {m.profiles?.email}
              {m.profiles?.email && m.profiles?.phone ? ' · ' : ''}
              {m.profiles?.phone}
            </div>
          )}
        </div>

        <span className={`pill ${degreePillClass(m.degree)}`}>{degreeLabel(m.degree)}</span>
      </div>
    )
  }

  const Section = ({ title, rows }: { title: string; rows: any[] }) =>
    rows.length === 0 ? null : (
      <div className="data-box" style={{ marginBottom: '1rem' }}>
        <div className="data-box-head">
          <span>{title}</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>{rows.length}</span>
        </div>
        {rows.map((m: any) => <Row key={m.id} m={m} />)}
      </div>
    )

  const mostSenior = [...(members ?? [])].sort((a: any, b: any) => degreeRank(b.degree) - degreeRank(a.degree))[0]

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>THE BRETHREN</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Roster</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
          {members?.length ?? 0} active {members?.length === 1 ? 'brother' : 'brethren'} of {tenant?.name} #{tenant?.number}
          {mostSenior?.degree ? ` · senior degree held: ${degreeLabel(mostSenior.degree)}` : ''}
        </p>
      </div>

      <Section title="Officers" rows={officers} />
      <Section title="Brethren" rows={brethren} />

      {(members?.length ?? 0) === 0 && (
        <div className="data-box">
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>
            No brethren on the roster yet.
          </div>
        </div>
      )}
    </div>
  )
}
