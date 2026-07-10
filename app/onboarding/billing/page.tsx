'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PLANS } from '@/types'

export default function BillingOnboardingPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState('pro')
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(false)
  const [tenantId, setTenantId] = useState('')

  useEffect(() => {
    const id = sessionStorage.getItem('onboarding_tenant_id')
    if (!id) { router.push('/onboarding/setup'); return }
    setTenantId(id)
  }, [])

  const handleSubscribe = async () => {
    setLoading(true)
    const res = await fetch('/api/billing/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, plan: selectedPlan, billing }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    else { setLoading(false) }
  }

  const handleSkip = () => {
    // Trial — go directly to done
    router.push('/onboarding/done')
  }

  return (
    <div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.75rem' }}>STEP 4 OF 5</div>
      <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: '#F5F0E8', marginBottom: '0.5rem' }}>Choose your plan</h1>
      <p style={{ fontSize: '1rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2rem' }}>14-day free trial on all plans. No charge until your trial ends. Cancel anytime.</p>

      {/* Billing toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', background: '#141C2E', padding: '6px', borderRadius: '6px', width: 'fit-content' }}>
        {(['monthly', 'annual'] as const).map(b => (
          <button key={b} onClick={() => setBilling(b)} style={{ padding: '8px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', background: billing === b ? '#C9A84C' : 'transparent', color: billing === b ? '#0A0E1A' : '#B8B0A0', transition: 'all 0.2s' }}>
            {b}{b === 'annual' ? ' (2 months free)' : ''}
          </button>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: 'rgba(201,168,76,0.1)', marginBottom: '2rem' }}>
        {Object.entries(PLANS).map(([key, plan]) => (
          <div key={key} onClick={() => setSelectedPlan(key)}
            style={{ background: selectedPlan === key ? '#1C2640' : '#141C2E', padding: '1.5rem', cursor: 'pointer', border: selectedPlan === key ? '2px solid #C9A84C' : '2px solid transparent', position: 'relative', transition: 'all 0.2s' }}>
            {key === 'pro' && <div style={{ position: 'absolute', top: '-1px', right: '12px', background: '#C9A84C', color: '#0A0E1A', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.52rem', letterSpacing: '0.08em', padding: '3px 10px', textTransform: 'uppercase' }}>Popular</div>}
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: selectedPlan === key ? '#C9A84C' : '#F5F0E8', marginBottom: '0.5rem' }}>{plan.name}</div>
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', fontWeight: 700, color: '#F5F0E8', lineHeight: 1 }}>
              ${billing === 'annual' ? plan.price_annual : plan.price_monthly}
              <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: '#B8B0A0', fontWeight: 400 }}>/mo</span>
            </div>
            {billing === 'annual' && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#5DBE85', marginTop: '2px' }}>Save ${((plan.price_monthly - plan.price_annual) * 12).toFixed(0)}/yr</div>}
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(201,168,76,0.1)', paddingTop: '1rem' }}>
              {plan.features.slice(0, 4).map(f => (
                <div key={f} style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#5DBE85', fontSize: '0.7rem', flexShrink: 0, marginTop: '2px' }}>✓</span>
                  <span style={{ fontSize: '0.8rem', color: '#B8B0A0' }}>{f}</span>
                </div>
              ))}
              {plan.features.length > 4 && <div style={{ fontSize: '0.75rem', color: 'rgba(184,176,160,0.5)', marginTop: '4px' }}>+{plan.features.length - 4} more features</div>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button onClick={() => router.push('/onboarding/members')} className="btn-outline" style={{ flex: 1 }}>← Back</button>
        <button onClick={handleSkip} className="btn-outline" style={{ flex: 1 }}>Continue with trial</button>
        <button onClick={handleSubscribe} disabled={loading} className="btn-gold" style={{ flex: 2, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Redirecting...' : `Start ${PLANS[selectedPlan].name} Trial →`}
        </button>
      </div>
      <p style={{ textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: 'rgba(184,176,160,0.4)', marginTop: '1rem', letterSpacing: '0.08em' }}>14-DAY FREE TRIAL · NO CHARGE UNTIL TRIAL ENDS · CANCEL ANYTIME</p>
    </div>
  )
}
