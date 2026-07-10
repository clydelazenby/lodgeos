import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function SuperAdminLodgesPage() {
  const supabase = await createClient()
  const { data: lodges } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  const statusColor: Record<string, string> = { active: 'pill-active', trialing: 'pill-trial', past_due: 'pill-past-due', canceled: 'pill-canceled' }
  const planColor: Record<string, string> = { starter: 'pill-ea', pro: 'pill-fc', district: 'pill-mm', trial: 'pill-new' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>All Lodges</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>{lodges?.length ?? 0} lodges on the platform</p>
        </div>
      </div>

      <div className="data-box">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Lodge', 'Location', 'Members', 'Plan', 'Status', 'MRR', 'Joined', ''].map(h => <th key={h} className="dash-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {lodges?.map((lodge: any) => (
              <tr key={lodge.id}>
                <td className="dash-td">
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem' }}>{lodge.name} #{lodge.number}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{lodge.email || '—'}</div>
                </td>
                <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>{lodge.city ? `${lodge.city}, ${lodge.state}` : '—'}</td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: '#B8B0A0', textAlign: 'center' }}>{lodge.member_count}</td>
                <td className="dash-td"><span className={`pill ${planColor[lodge.plan] ?? 'pill-new'}`}>{lodge.plan}</span></td>
                <td className="dash-td"><span className={`pill ${statusColor[lodge.subscription_status] ?? 'pill-new'}`}>{lodge.subscription_status}</span></td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#5DBE85' }}>
                  {lodge.plan === 'starter' ? '$19' : lodge.plan === 'pro' ? '$39' : lodge.plan === 'district' ? '$79' : '$0'}
                </td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#B8B0A0' }}>{format(new Date(lodge.created_at), 'MMM d, yy')}</td>
                <td className="dash-td">
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Link href={`/super-admin/lodges/${lodge.id}`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: '#C9A84C', textDecoration: 'none', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', padding: '4px 8px' }}>Manage</Link>
                    <Link href={`/lodge/${lodge.slug}/dashboard`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: '#7BB8D4', textDecoration: 'none', background: 'rgba(74,127,165,0.1)', border: '1px solid rgba(74,127,165,0.2)', padding: '4px 8px' }}>View</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!lodges || lodges.length === 0) && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No lodges yet.</div>
        )}
      </div>
    </div>
  )
}
