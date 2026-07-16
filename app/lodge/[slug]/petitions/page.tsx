import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { PetitionRowActions } from '@/components/lodge/PetitionRowActions'

export default async function LodgePetitionsPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', params.slug).single()
  if (!tenant) notFound()

  const { data: petitions } = await supabase
    .from('petitions')
    .select('*')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  const counts = { new: 0, under_review: 0, approved: 0, denied: 0 }
  petitions?.forEach((p: any) => { if (counts[p.status as keyof typeof counts] !== undefined) counts[p.status as keyof typeof counts]++ })

  const statusCls: Record<string, string> = { new: 'pill-new', under_review: 'pill-fc', approved: 'pill-active', denied: 'pill-canceled' }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Petitions</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Review and manage membership applications</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '2rem' }}>
        {[['New', counts.new, '#7BB8D4'], ['Under Review', counts.under_review, '#C9A84C'], ['Approved', counts.approved, '#5DBE85'], ['Denied', counts.denied, '#E74C3C']].map(([l, v, c]) => (
          <div key={l as string} style={{ background: '#141C2E', padding: '1.25rem' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{l}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', fontWeight: 700, color: c as string, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="data-box">
        <div className="data-box-head">All Petitions</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Petitioner', 'Submitted', 'Age · Occupation', 'Referred By', 'Reason', 'Status', 'Action'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {petitions?.map((p: any) => (
              <tr key={p.id}>
                <td className="dash-td">
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem' }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#B8B0A0' }}>{p.email}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#B8B0A0' }}>{p.phone}</div>
                </td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#B8B0A0', whiteSpace: 'nowrap' }}>{format(new Date(p.created_at), 'MMM d, yyyy')}</td>
                <td className="dash-td" style={{ fontSize: '0.85rem', color: '#B8B0A0' }}>{p.age ?? '—'} · {p.occupation || '—'}</td>
                <td className="dash-td" style={{ fontSize: '0.85rem', color: '#B8B0A0' }}>{p.referred_by || '—'}</td>
                <td className="dash-td" style={{ fontSize: '0.85rem', color: '#B8B0A0', maxWidth: '200px' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.reason || '—'}</div>
                </td>
                <td className="dash-td">
                  <span className={`pill ${statusCls[p.status] ?? 'pill-new'}`}>{p.status.replace('_', ' ')}</span>
                </td>
                <td className="dash-td">
                  <PetitionRowActions petitionId={p.id} tenantId={tenant.id} status={p.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!petitions || petitions.length === 0) && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No petitions submitted yet. Share your public website to receive applications.</div>
        )}
      </div>
    </div>
  )
}
