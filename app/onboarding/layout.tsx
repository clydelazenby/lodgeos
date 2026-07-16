import Link from 'next/link'

const steps = [
  { num: 1, label: 'Lodge Info', href: '/onboarding/setup' },
  { num: 2, label: 'Branding', href: '/onboarding/brand' },
  { num: 3, label: 'Members', href: '/onboarding/members' },
  { num: 4, label: 'Billing', href: '/onboarding/billing' },
  { num: 5, label: 'Done', href: '/onboarding/done' },
]

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(201,168,76,0.15)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.2em', textDecoration: 'none' }}>LODGEOS</Link>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', letterSpacing: '0.2em' }}>LODGE SETUP</div>
      </header>

      {/* Steps */}
      <div style={{ borderBottom: '1px solid rgba(201,168,76,0.1)', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'center', gap: '0', overflowX: 'auto' }}>
        {steps.map((step, i) => (
          <div key={step.num} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 1rem' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#C9A84C', flexShrink: 0 }}>
                {step.num}
              </div>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.7rem', color: '#B8B0A0', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{step.label}</span>
            </div>
            {i < steps.length - 1 && <div style={{ width: '32px', height: '1px', background: 'rgba(201,168,76,0.2)', flexShrink: 0 }} />}
          </div>
        ))}
      </div>

      {/* Content */}
      <main style={{ maxWidth: '640px', margin: '0 auto', padding: '3rem 2rem' }}>
        {children}
      </main>
    </div>
  )
}
