import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function PortalPage() {
<<<<<<< HEAD
  const supabase = createClient()
=======
  const supabase = await createClient()
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('tenant_members')
      .select('*, tenants(id, name, number, primary_color, dues_amount)')
      .eq('user_id', user.id).eq('is_active', true).single(),
  ])

  if (!membership) redirect('/auth/login')
  const tenant = (membership as any).tenants
  const today = new Date().toISOString().split('T')[0]

  const [{ data: events }, { data: payments }, { data: degrees }] = await Promise.all([
    supabase.from('lodge_events').select('*').eq('tenant_id', tenant.id).gte('event_date', today).order('event_date').limit(3),
    supabase.from('payments').select('*').eq('member_id', user.id).eq('status', 'succeeded').order('created_at', { ascending: false }).limit(3),
    supabase.from('degree_progress').select('*').eq('member_id', user.id).eq('tenant_id', tenant.id),
  ])

  const duesDue = (membership as any).dues_status === 'due'

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.5rem' }}>BROTHER PORTAL</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          Welcome, Brother <span style={{ color: '#C9A84C' }}>{profile?.first_name}</span>
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>{tenant.name} #{tenant.number} · {(membership as any).lodge_role || (membership as any).degree}</p>
      </div>

      {/* Dues alert */}
      {duesDue && (
        <div style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: '#E74C3C', marginBottom: '0.25rem' }}>Annual Dues Outstanding</div>
            <p style={{ fontSize: '0.9rem', color: '#B8B0A0', margin: 0 }}>Your {new Date().getFullYear()} dues of <strong style={{ color: '#F5F0E8' }}>${tenant.dues_amount}</strong> are due. Pay now to maintain good standing.</p>
          </div>
          <Link href="/portal/dues" className="btn-gold" style={{ fontSize: '0.68rem', whiteSpace: 'nowrap' }}>Pay Dues Now →</Link>
        </div>
      )}

      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '2rem' }}>
        <div style={{ background: '#141C2E', padding: '1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Degree</div>
          <span className={`pill pill-${(membership as any).degree?.toLowerCase()}`}>{(membership as any).degree}</span>
        </div>
        <div style={{ background: '#141C2E', padding: '1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Dues Status</div>
          <span className={`pill pill-${(membership as any).dues_status}`}>{(membership as any).dues_status}</span>
        </div>
        <div style={{ background: '#141C2E', padding: '1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Amount Due</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.6rem', fontWeight: 700, color: duesDue ? '#E74C3C' : '#5DBE85' }}>{duesDue ? `$${tenant.dues_amount}` : '$0'}</div>
        </div>
        <div style={{ background: '#141C2E', padding: '1.4rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>Role</div>
<<<<<<< HEAD
          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', color: '#F5F0E8' }}>{(membership as any).lodge_role || 'Member'}</div>
=======
          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1rem', color: '#F5F0E8' }}>{(membership as any).lodge_role || 'Member'}</div>
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* Upcoming events */}
        <div className="data-box">
          <div className="data-box-head"><span>Upcoming Events</span><Link href="/portal/events" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>All →</Link></div>
          {events && events.length > 0 ? events.map((ev: any, i: number) => (
            <div key={ev.id} style={{ padding: '0.85rem 1.4rem', borderBottom: i < events.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none' }}>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8', marginBottom: '2px' }}>{ev.title}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{format(new Date(ev.event_date + 'T12:00:00'), 'MMM d, yyyy')}{ev.dress_code && ` · ${ev.dress_code}`}</div>
            </div>
          )) : <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>No upcoming events.</div>}
        </div>

        {/* Payment history */}
        <div className="data-box">
          <div className="data-box-head"><span>Payment History</span><Link href="/portal/dues" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>All →</Link></div>
          {payments && payments.length > 0 ? payments.map((p: any, i: number) => (
            <div key={p.id} style={{ padding: '0.85rem 1.4rem', borderBottom: i < payments.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: '#F5F0E8' }}>Dues {p.dues_year}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{format(new Date(p.created_at), 'MMM d, yyyy')}</div>
              </div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: '#5DBE85', fontWeight: 700 }}>${p.amount}</div>
            </div>
          )) : <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>No payments yet.</div>}
        </div>
      </div>
    </div>
  )
}
