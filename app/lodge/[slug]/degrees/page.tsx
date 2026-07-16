import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { ProficiencyControl } from '@/components/lodge/ProficiencyControl'

export default async function LodgeDegreesPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', params.slug).single()
  if (!tenant) notFound()

  const { data: members } = await supabase
    .from('tenant_members')
    .select('*, profiles(first_name, last_name)')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('degree')

  const { data: progress } = await supabase
    .from('degree_progress')
    .select('*, profiles(first_name, last_name)')
    .eq('tenant_id', tenant.id)

  const ea = members?.filter((m: any) => m.degree === 'EA') ?? []
  const fc = members?.filter((m: any) => m.degree === 'FC') ?? []
  const mm = members?.filter((m: any) => m.degree === 'MM') ?? []

  // `progress` was fetched and never read anywhere in this file before.
  // Indexed by member+degree so each row looks up its own record in O(1).
  const progressByMember: Record<string, any> = {}
  for (const p of progress ?? []) progressByMember[`${p.member_id}:${p.degree}`] = p

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Degree Tracker</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Track every brother's progression through the craft</p>
      </div>

      {/* Degree counts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '2rem' }}>
        {[['I°', 'Entered Apprentice', ea.length, '#7BB8D4'], ['II°', 'Fellowcraft', fc.length, '#C9A84C'], ['III°', 'Master Mason', mm.length, '#5DBE85']].map(([deg, name, count, color]) => (
          <div key={deg as string} style={{ background: '#141C2E', padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', fontWeight: 900, color: color as string, lineHeight: 1, marginBottom: '0.4rem' }}>{deg}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8', marginBottom: '0.5rem' }}>{name}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', fontWeight: 700, color: '#F5F0E8' }}>{count as number}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>brothers</div>
          </div>
        ))}
      </div>

      {/* Full member degree table */}
      <div className="data-box">
        <div className="data-box-head">All Members — Degree Status</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Brother', 'Current Degree', 'Lodge Role', 'Joined', 'Proficiency', 'Notes'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr></thead>
          <tbody>
            {members?.map((m: any) => (
              <tr key={m.id}>
                <td className="dash-td">
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>Bro. {m.profiles?.first_name} {m.profiles?.last_name}</div>
                </td>
                <td className="dash-td"><span className={`pill pill-${m.degree?.toLowerCase()}`}>{m.degree}</span></td>
                <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>{m.lodge_role || '—'}</td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#B8B0A0' }}>
                  {m.joined_date ? format(new Date(m.joined_date), 'MMM yyyy') : '—'}
                </td>
                <td className="dash-td">
                  <ProficiencyControl
                    tenantId={tenant.id}
                    memberId={m.user_id}
                    degree={m.degree}
                    progress={progressByMember[`${m.user_id}:${m.degree}`] ?? null}
                  />
                </td>
                <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>{m.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!members || members.length === 0) && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No members yet.</div>
        )}
      </div>
    </div>
  )
}
