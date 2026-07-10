import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'

export default async function LodgeDashboardPage({ params }: { params: { slug: string } }) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: tenant } = await supabase.from('tenants').select('*').eq('slug', params.slug).single()
  if (!tenant) notFound()

  const [
    { count: memberCount },
    { count: petitionCount },
    { count: dueCount },
    { data: events },
    { data: recentPayments },
  ] = await Promise.all([
    supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('is_active', true),
    supabase.from('petitions').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('status', 'new'),
    supabase.from('tenant_members').select('*', { count: 'exact', head: true }).eq('tenant_id', tenant.id).eq('dues_status', 'due').eq('is_active', true),
    supabase.from('lodge_events').select('*').eq('tenant_id', tenant.id).gte('event_date', today).order('event_date').limit(4),
    supabase.from('payments').select('*, profiles(first_name, last_name)').eq('tenant_id', tenant.id).eq('status', 'succeeded').order('created_at', { ascending: false }).limit(5),
  ])

  const typeColor: Record<string, string> = { degree: 'pill-fc', grand_lodge: 'pill-mm', stated_communication: 'pill-ea', social: 'pill-active', other: 'pill-new' }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>
          {tenant.name} <span style={{ color: '#C9A84C' }}>#{tenant.number}</span>
        </h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>{tenant.city ? `${tenant.city}, ${tenant.state}` : 'Lodge Admin Dashboard'} · {tenant.plan} plan</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '2rem' }}>
        {[
          { label: 'Active Brothers', value: memberCount ?? 0, color: '#5DBE85', note: 'In good standing' },
          { label: 'New Petitions', value: petitionCount ?? 0, color: '#C9A84C', note: 'Awaiting review', href: `/lodge/${params.slug}/petitions` },
          { label: 'Dues Outstanding', value: dueCount ?? 0, color: '#E74C3C', note: 'Brothers with balance', href: `/lodge/${params.slug}/dues` },
          { label: 'Annual Dues', value: `$${tenant.dues_amount}`, color: '#7BB8D4', note: 'Per brother per year' },
        ].map(({ label, value, color, note, href }) => (
          <div key={label} style={{ background: '#141C2E', padding: '1.4rem' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.6rem' }}>{label}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', fontWeight: 700, color: '#F5F0E8', lineHeight: 1, marginBottom: '0.25rem' }}>{value}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color }}>{note}</div>
            {href && <Link href={href} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#C9A84C', textDecoration: 'none', letterSpacing: '0.08em', display: 'block', marginTop: '4px' }}>View →</Link>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Events */}
        <div className="data-box">
          <div className="data-box-head">
            <span>Upcoming Events</span>
            <Link href={`/lodge/${params.slug}/events`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>Manage →</Link>
          </div>
          {events && events.length > 0 ? events.map((ev: any, i: number) => (
            <div key={ev.id} style={{ padding: '0.85rem 1.4rem', borderBottom: i < events.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8', marginBottom: '2px' }}>{ev.title}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{format(new Date(ev.event_date + 'T12:00:00'), 'MMM d, yyyy')}</div>
              </div>
              <span className={`pill ${typeColor[ev.event_type] ?? 'pill-new'}`}>{ev.event_type.replace('_', ' ')}</span>
            </div>
          )) : <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>No upcoming events.</div>}
        </div>

        {/* Recent payments */}
        <div className="data-box">
          <div className="data-box-head">
            <span>Recent Payments</span>
            <Link href={`/lodge/${params.slug}/dues`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>View all →</Link>
          </div>
          {recentPayments && recentPayments.length > 0 ? recentPayments.map((p: any, i: number) => (
            <div key={p.id} style={{ padding: '0.85rem 1.4rem', borderBottom: i < recentPayments.length - 1 ? '1px solid rgba(201,168,76,0.05)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#F5F0E8', marginBottom: '2px' }}>
                  {p.profiles ? `Bro. ${p.profiles.first_name} ${p.profiles.last_name}` : 'Unknown'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{format(new Date(p.created_at), 'MMM d, yyyy')}</div>
              </div>
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: '#5DBE85', fontWeight: 700 }}>${p.amount}</div>
            </div>
          )) : <div style={{ padding: '2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontSize: '0.9rem' }}>No payments yet.</div>}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)' }}>
        {[
          { label: '+ Add Member', desc: 'Register a new brother', href: `/lodge/${params.slug}/members` },
          { label: '+ Create Event', desc: 'Schedule a lodge meeting', href: `/lodge/${params.slug}/events` },
          { label: '✉ Send Notice', desc: 'Communicate with brothers', href: `/lodge/${params.slug}/communications` },
          { label: '⚙ Settings', desc: 'Configure your lodge', href: `/lodge/${params.slug}/settings` },
        ].map(({ label, desc, href }) => (
          <Link key={label} href={href} style={{ background: '#141C2E', padding: '1.4rem', textDecoration: 'none', display: 'block', transition: 'background 0.2s' }}>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.82rem', color: '#C9A84C', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '0.82rem', color: '#B8B0A0' }}>{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
