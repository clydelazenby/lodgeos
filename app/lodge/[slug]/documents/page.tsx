import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { DocumentUploadButton, DocumentDownloadLink } from '@/components/lodge/DocumentUpload'

export default async function LodgeDocumentsPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', params.slug).single()
  if (!tenant) notFound()

  const { data: docs } = await supabase
    .from('documents')
    .select('*, profiles(first_name, last_name)')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })

  const accessColor: Record<string, string> = { all: 'pill-active', EA: 'pill-ea', FC: 'pill-fc', MM: 'pill-mm' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Document Library</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Secure lodge documents with degree-based access control</p>
        </div>
        <DocumentUploadButton tenantId={tenant.id} />
      </div>

      {/* Default categories */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '2rem' }}>
        {[
          { label: 'Degree Materials', count: docs?.filter((d: any) => d.category === 'Degree Materials').length ?? 0 },
          { label: 'Meeting Minutes', count: docs?.filter((d: any) => d.category === 'Minutes').length ?? 0 },
          { label: 'Administration', count: docs?.filter((d: any) => d.category === 'Administration').length ?? 0 },
          { label: 'Grand Lodge', count: docs?.filter((d: any) => d.category === 'Grand Lodge').length ?? 0 },
        ].map(({ label, count }) => (
          <div key={label} style={{ background: '#141C2E', padding: '1.25rem' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{label}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', fontWeight: 700, color: '#F5F0E8', lineHeight: 1 }}>{count}</div>
          </div>
        ))}
      </div>

      <div className="data-box">
        <div className="data-box-head">All Documents</div>
        {docs && docs.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Document', 'Category', 'Uploaded By', 'Date', 'Access Level', ''].map(h => <th key={h} className="dash-th">{h}</th>)}</tr></thead>
            <tbody>
              {docs.map((d: any) => (
                <tr key={d.id}>
                  <td className="dash-td"><div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>{d.name}</div><div style={{ fontSize: '0.78rem', color: '#B8B0A0', marginTop: '2px' }}>{d.description || ''}</div></td>
                  <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>{d.category}</td>
                  <td className="dash-td" style={{ fontSize: '0.82rem', color: '#B8B0A0' }}>{d.profiles ? `${d.profiles.first_name} ${d.profiles.last_name}` : '—'}</td>
                  <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#B8B0A0' }}>{format(new Date(d.created_at), 'MMM d, yyyy')}</td>
                  <td className="dash-td"><span className={`pill ${accessColor[d.access_level] ?? 'pill-new'}`}>{d.access_level === 'all' ? 'All Brothers' : `${d.access_level}+`}</span></td>
                  <td className="dash-td"><DocumentDownloadLink documentId={d.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>
            No documents uploaded yet. Upload degree materials, meeting minutes, and bylaws here.
          </div>
        )}
      </div>

      <div style={{ marginTop: '1rem', padding: '1rem 1.5rem', background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0', letterSpacing: '0.08em' }}>ACCESS LEVELS:</span>
        {[['All Brothers', 'pill-active'], ['EA+', 'pill-ea'], ['FC+', 'pill-fc'], ['MM Only', 'pill-mm']].map(([l, c]) => (
          <span key={l} className={`pill ${c}`}>{l}</span>
        ))}
      </div>
    </div>
  )
}
