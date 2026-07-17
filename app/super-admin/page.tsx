import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'

// export default async function SuperAdminPage() {
//   return (
//     <div style={{ padding: 40, color: 'white' }}>
//       SUPER ADMIN WORKS
//     </div>
//   )
// }
export default async function SuperAdminPage() {
  const supabase = await createClient()
  console.log(
  'SUPABASE URL:',
  process.env.NEXT_PUBLIC_SUPABASE_URL
)

const tenantsCheck = await supabase
  .from('tenants')
  .select('*')

console.log('TENANTS CHECK:', tenantsCheck)
  console.log('SUPABASE URL', process.env.NEXT_PUBLIC_SUPABASE_URL)

const tenantsTest = await supabase
  .from('tenants')
  .select('*')

console.log('TENANTS TEST', tenantsTest)
  const [
    { count: totalLodges },
    { count: activeLodges },
    { count: trialLodges },
    { data: recentLodges },
    { data: planBreakdown },
  ] = await Promise.all([
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'active'),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('subscription_status', 'trialing'),
    supabase.from('tenants').select('id, name, number, slug, plan, subscription_status, member_count, created_at').order('created_at', { ascending: false }).limit(8),
    supabase.from('tenants').select('plan').order('plan'),
  ])

  const planCounts = (planBreakdown ?? []).reduce((acc: any, { plan }: any) => {
    acc[plan] = (acc[plan] || 0) + 1; return acc
  }, {})

  const mrr = (planCounts.starter || 0) * 19 + (planCounts.pro || 0) * 39 + (planCounts.district || 0) * 79

  const statusColor: Record<string, string> = { active: 'pill-active', trialing: 'pill-trial', past_due: 'pill-past-due', canceled: 'pill-canceled', incomplete: 'pill-canceled' }
  const planColor: Record<string, string> = { starter: 'pill-ea', pro: 'pill-fc', district: 'pill-mm', trial: 'pill-new' }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Platform Overview</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>LodgeOS · Super Admin Dashboard</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '2rem' }}>
        {[
          { label: 'Total Lodges', value: totalLodges ?? 0, color: '#F5F0E8' },
          { label: 'Active Paid', value: activeLodges ?? 0, color: '#5DBE85' },
          { label: 'On Trial', value: trialLodges ?? 0, color: '#C9A84C' },
          { label: 'MRR', value: `$${mrr.toLocaleString()}`, color: '#5DBE85' },
          { label: 'Starter', value: planCounts.starter || 0, color: '#7BB8D4' },
          { label: 'Pro', value: planCounts.pro || 0, color: '#C9A84C' },
          { label: 'District', value: planCounts.district || 0, color: '#5DBE85' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#141C2E', padding: '1.25rem' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>{label}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Recent lodges */}
      <div className="data-box">
        <div className="data-box-head">
          <span>Recent Lodges</span>
          <Link href="/super-admin/lodges" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#C9A84C', textDecoration: 'none', letterSpacing: '0.1em' }}>View all →</Link>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Lodge', 'Members', 'Plan', 'Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="dash-th">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentLodges?.map((lodge: any) => (
              <tr key={lodge.id}>
                <td className="dash-td">
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem' }}>{lodge.name}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', color: '#B8B0A0' }}>#{lodge.number} · {lodge.slug}</div>
                </td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: '#B8B0A0' }}>{lodge.member_count}</td>
                <td className="dash-td"><span className={`pill ${planColor[lodge.plan] ?? 'pill-new'}`}>{lodge.plan}</span></td>
                <td className="dash-td"><span className={`pill ${statusColor[lodge.subscription_status] ?? 'pill-new'}`}>{lodge.subscription_status}</span></td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#B8B0A0' }}>{format(new Date(lodge.created_at), 'MMM d, yyyy')}</td>
                <td className="dash-td">
                  <Link href={`/super-admin/lodges/${lodge.id}`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', padding: '4px 10px' }}>Manage</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!recentLodges || recentLodges.length === 0) && (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No lodges yet. Share lodgeos.com to get your first customers.</div>
        )}
      </div>
    </div>
  )
}
