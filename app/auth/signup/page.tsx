'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [step, setStep] = useState<'account' | 'lodge'>('account')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const router = useRouter()

  const handleAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = await createClient()
    const { error: err } = await supabase.auth.signUp({
      email: account.email,
      password: account.password,
      options: {
        data: { first_name: account.firstName, last_name: account.lastName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (err) { setError(err.message); setLoading(false); return }
    router.push('/onboarding/setup')
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '12px 16px', fontFamily: 'Crimson Pro, serif', fontSize: '1rem', outline: 'none', borderRadius: '4px', transition: 'border-color 0.2s' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link href="/" style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.2em', textDecoration: 'none' }}>LODGEOS</Link>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', letterSpacing: '0.2em', marginTop: '4px' }}>START YOUR FREE 14-DAY TRIAL</p>
        </div>

        <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.2)', padding: '2.5rem', borderRadius: '8px' }}>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#F5F0E8', marginBottom: '0.4rem' }}>Create your account</h1>
          <p style={{ fontSize: '0.95rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2rem' }}>No credit card required. Setup takes 10 minutes.</p>

          <form onSubmit={handleAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input value={account.firstName} onChange={e => setAccount(p => ({ ...p, firstName: e.target.value }))} placeholder="John" style={inputStyle} required />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input value={account.lastName} onChange={e => setAccount(p => ({ ...p, lastName: e.target.value }))} placeholder="Smith" style={inputStyle} required />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input type="email" value={account.email} onChange={e => setAccount(p => ({ ...p, email: e.target.value }))} placeholder="secretary@lodge.com" style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" value={account.password} onChange={e => setAccount(p => ({ ...p, password: e.target.value }))} placeholder="At least 8 characters" style={inputStyle} minLength={8} required />
            </div>
            {error && <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#E74C3C', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '4px' }}>{error}</div>}
            <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem' }}>
              {loading ? 'Creating account...' : 'Create Account & Continue →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#B8B0A0', marginTop: '1.5rem' }}>
            Already have an account? <Link href="/auth/login" style={{ color: '#C9A84C', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'rgba(184,176,160,0.4)', marginTop: '1.5rem', fontStyle: 'italic' }}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  )
}
