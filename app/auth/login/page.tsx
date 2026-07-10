'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
export default function LoginPage() {
 const [email, setEmail] = useState('')
 const [password, setPassword] = useState('')
 const [loading, setLoading] = useState(false)
 const [error, setError] = useState('')
 const router = useRouter()
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault()

  console.log('===== LOGIN START =====')

  setLoading(true)
  setError('')

  try {
    const supabase = createClient()

    console.log('Attempting sign in...')

    const { data, error: err } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      })

    console.log('AUTH DATA:', data)
    console.log('AUTH ERROR:', err)

    if (err) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }

    console.log('USER ID:', data.user.id)

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single()

    console.log('PROFILE:', profile)
    console.log('PROFILE ERROR:', profileError)

    if (profile?.platform_role === 'super_admin') {
      console.log('SUPER ADMIN DETECTED')
      console.log('REDIRECTING TO /super-admin')
window.location.href = '/super-admin'
      // router.refresh()
      // router.push('/super-admin')

      return
    }

    console.log('CHECKING MEMBERSHIP')

    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from('tenant_members')
      .select('tenant_id, tenant_role, tenants(slug)')
      .eq('user_id', data.user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    console.log('MEMBERSHIP:', membership)
    console.log('MEMBERSHIP ERROR:', membershipError)

    if (membership) {
      const slug = (membership.tenants as any)?.slug

      console.log('LODGE SLUG:', slug)

      router.refresh()

      const OFFICER_TIERS = new Set([
        'admin',
        'secretary',
        'worshipful_master',
        'treasurer',
        'warden',
        'deacon',
      ])

      if (OFFICER_TIERS.has(membership.tenant_role)) {
        console.log(
          `REDIRECTING TO /lodge/${slug}/dashboard`
        )

        router.push(`/lodge/${slug}/dashboard`)
      } else {
        console.log('REDIRECTING TO /portal')

        router.push('/portal')
      }

      return
    }

    console.log(
      'NO MEMBERSHIP FOUND - REDIRECTING TO ONBOARDING'
    )

    router.refresh()
    router.push('/onboarding/setup')
  } catch (e) {
    console.error('LOGIN CRASH:', e)

    setError(
      'Something went wrong signing in. Please try again.'
    )

    setLoading(false)
  }
}
 const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '12px 16px', fontFamily: 'Crimson Pro, serif', fontSize: '1rem', outline: 'none', borderRadius: '4px' }
 const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }
 return (
<div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
<div style={{ width: '100%', maxWidth: '420px' }}>
<div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
<Link href="/" style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.2em', textDecoration: 'none' }}>LODGEOS</Link>
<p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', letterSpacing: '0.2em', marginTop: '4px' }}>LODGE MANAGEMENT PLATFORM</p>
</div>
<div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.2)', padding: '2.5rem', borderRadius: '8px' }}>
<h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#F5F0E8', marginBottom: '2rem' }}>Sign in to LodgeOS</h1>
<form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
<div>
<label style={labelStyle}>Email Address</label>
<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} required />
</div>
<div>
<label style={labelStyle}>Password</label>
<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inputStyle} required />
</div>
           {error && <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#E74C3C', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '4px' }}>{error}</div>}
<button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
             {loading ? 'Signing in...' : 'Sign In'}
</button>
</form>
<p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#B8B0A0', marginTop: '1.5rem' }}>
           Don't have an account? <Link href="/auth/signup" style={{ color: '#C9A84C', textDecoration: 'none' }}>Start free trial</Link>
</p>
</div>
</div>
</div>
 )
}