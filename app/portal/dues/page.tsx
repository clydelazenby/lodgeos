'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function PortalDuesPage() {
  const [membership, setMembership] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = await createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: m }, { data: p }] = await Promise.all([
        supabase.from('tenant_members').select('*, tenants(id, name, number, dues_amount)').eq('user_id', user.id).eq('is_active', true).single(),
        supabase.from('payments').select('*').eq('member_id', user.id).eq('status', 'succeeded').order('created_at', { ascending: false }),
      ])
      setMembership(m)
      setPayments(p ?? [])
    }
    load()
  }, [])

  const handlePay = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !membership) return

    const res = await fetch('/api/dues/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: membership.tenants.id,
        memberId: user.id,
        amount: membership.tenants.dues_amount,
        year: new Date().getFullYear(),
      }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(false)
  }

  const duesDue = membership?.dues_status === 'due'
  const tenant = membership?.tenants

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Dues & Payments</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Manage your annual lodge dues</p>
      </div>

      {/* Current status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '2rem' }}>
        <div style={{ background: '#141C2E', padding: '1.5rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Current Year</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', fontWeight: 700, color: '#F5F0E8' }}>{new Date().getFullYear()}</div>
        </div>
        <div style={{ background: '#141C2E', padding: '1.5rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Annual Amount</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2rem', fontWeight: 700, color: '#F5F0E8' }}>${tenant?.dues_amount ?? '—'}</div>
        </div>
        <div style={{ background: '#141C2E', padding: '1.5rem' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Status</div>
          <span className={`pill pill-${membership?.dues_status ?? 'new'}`}>{membership?.dues_status ?? '—'}</span>
        </div>
      </div>

      {/* Pay button */}
      {duesDue ? (
        <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.15)', padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#F5F0E8', marginBottom: '0.5rem' }}>
            {new Date().getFullYear()} dues outstanding
          </div>
          <p style={{ fontSize: '1rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '1.5rem' }}>
            Pay your annual dues to maintain good standing in {tenant?.name} #{tenant?.number}.
          </p>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '2.5rem', fontWeight: 700, color: '#C9A84C', marginBottom: '1.5rem' }}>${tenant?.dues_amount}</div>
          <button onClick={handlePay} disabled={loading} className="btn-gold" style={{ fontSize: '0.8rem', padding: '14px 48px', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Redirecting to payment...' : `Pay $${tenant?.dues_amount} Now →`}
          </button>
          <p style={{ fontSize: '0.8rem', color: 'rgba(184,176,160,0.5)', marginTop: '1rem', fontStyle: 'italic' }}>
            Secure payment powered by Stripe. Your card details never touch our servers.
          </p>
        </div>
      ) : (
        <div style={{ background: 'rgba(39,174,96,0.1)', border: '1px solid rgba(39,174,96,0.25)', padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✓</div>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#5DBE85', marginBottom: '0.5rem' }}>Dues paid — Good Standing</div>
          <p style={{ fontSize: '0.95rem', color: '#B8B0A0', fontStyle: 'italic' }}>Your {new Date().getFullYear()} dues are paid. Thank you, Brother.</p>
        </div>
      )}

      {/* Payment history */}
      <div className="data-box">
        <div className="data-box-head">Payment History</div>
        {payments.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Year', 'Amount', 'Date', 'Receipt'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr></thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.id}>
                  <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem' }}>{p.dues_year || '—'}</td>
                  <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: '#5DBE85', fontWeight: 700 }}>${p.amount}</td>
                  <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#B8B0A0' }}>
                    {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="dash-td">
                    {p.receipt_url ? (
                      <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', padding: '4px 10px' }}>View</a>
                    ) : <span style={{ color: '#B8B0A0', fontSize: '0.82rem' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No payment history yet.</div>}
      </div>
    </div>
  )
}
