<<<<<<< HEAD
﻿'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [debug, setDebug] = useState('Waiting for login...')

 const handleLogin = async function (event: any) {
  event.preventDefault()

  setLoading(true)
  setError('')
  setDebug('Logging in...')

  try {
  const res = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email,
    password,
  }),
})

    const result = await res.json()

    console.log('LOGIN API RESULT:', result)

    if (!res.ok) {
      setError(result.error || 'Login failed.')
      setDebug('Login failed.')
=======
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
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
      setLoading(false)
      return
    }

<<<<<<< HEAD
    setDebug('Login successful. Redirecting...')

    window.location.replace(result.redirectTo || '/portal')
  } catch (err: any) {
    console.error('LOGIN CRASH:', err)
    setError(err?.message || 'Something went wrong signing in.')
    setDebug('Login crashed. Check console.')
    setLoading(false)
  }
}

  return React.createElement(
    'div',
    {
      className: 'login-page-container',
style: {
  minHeight: '100vh',
  backgroundImage: `
    linear-gradient(
      rgba(4,10,20,.55),
      rgba(4,10,20,.55)
    ),
    url('/assets/lodgeos/images/login-bg.png')
  `,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  padding: '4rem 8rem',
},
    },
    React.createElement(
      'div',
      {
        style: {
          width: '100%',
          maxWidth: '460px',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            textAlign: 'center',
            marginBottom: '2.5rem',
          },
        },
        React.createElement(
          'a',
          {
            href: '/',
            style: {
              fontFamily: 'Cinzel, serif',
              fontSize: '1.4rem',
              fontWeight: 700,
              color: '#C9A84C',
              letterSpacing: '0.2em',
              textDecoration: 'none',
              className: 'login-description',
            },
          },
          'LODGEOS'
        ),
        React.createElement(
          'p',
          {
            style: {
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.6rem',
              color: '#B8B0A0',
              letterSpacing: '0.2em',
              marginTop: '4px',
            },
          },
          'LODGE MANAGEMENT PLATFORM'
        )
      ),
      React.createElement(
  'p',
  {
    style: {
      color: '#DCCFB5',
      lineHeight: 1.7,
      marginBottom: '2rem',
      fontSize: '.95rem',
      className: 'login-description',
    },
  },
  'Access lodge communications, membership records, events, officer tools, and administrative resources.'
),
      React.createElement(
        'div',
        {
 style: {
  background: 'rgba(20,34,52,.82)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(201,168,76,.25)',
  padding: '2.5rem',
  borderRadius: '10px',
  boxShadow: '0 30px 80px rgba(0,0,0,.45)',
},
        },
        React.createElement(
          'h1',
          {
            style: {
              fontFamily: 'Cinzel, serif',
              fontSize: '1.2rem',
              color: '#F5F0E8',
              marginBottom: '2rem',
            },
          },
          'Welcome Back Brother'
        ),
        React.createElement(
          'form',
          {
            onSubmit: handleLogin,
            style: {
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            },
          },
          React.createElement(
            'div',
            null,
            React.createElement(
              'label',
              {
                style: {
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.62rem',
                  letterSpacing: '0.2em',
                  color: '#C9A84C',
                  marginBottom: '6px',
                  display: 'block',
                },
              },
              'Email Address'
            ),
            React.createElement('input', {
              type: 'email',
              value: email,
              onChange: function (event: any) {
                setEmail(event.target.value)
              },
              placeholder: 'your@email.com',
              required: true,
              style: {
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(201,168,76,0.2)',
                color: '#F5F0E8',
                padding: '12px 16px',
                fontFamily: 'Crimson Pro, serif',
                fontSize: '1.1rem',
                outline: 'none',
                borderRadius: '4px',
              },
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement(
              'label',
              {
                style: {
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.62rem',
                  letterSpacing: '0.2em',
                  color: '#C9A84C',
                  marginBottom: '6px',
                  display: 'block',
                },
              },
              'Password'
            ),
            React.createElement('input', {
              type: 'password',
              value: password,
              onChange: function (event: any) {
                setPassword(event.target.value)
              },
              placeholder: 'Password',
              required: true,
              style: {
                width: '100%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(201,168,76,0.2)',
                color: '#F5F0E8',
                padding: '12px 16px',
                fontFamily: 'Crimson Pro, serif',
                fontSize: '1.1rem',
                outline: 'none',
                borderRadius: '4px',
              },
            })
          ),
          error
            ? React.createElement(
                'div',
                {
                  style: {
                    background: 'rgba(192,57,43,0.15)',
                    border: '1px solid rgba(192,57,43,0.3)',
                    color: '#E74C3C',
                    padding: '10px 14px',
                    fontSize: '0.9rem',
                    borderRadius: '4px',
                  },
                },
                error
              )
            : null,
          React.createElement(
            'button',
            {
              type: 'submit',
              disabled: loading,
              className: 'btn-gold',
              style: {
                width: '100%',
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              },
            },
            loading ? 'Signing in...' : 'Sign In'
          )
        ),
        React.createElement(
          'div',
          {
            style: {
              marginTop: '1rem',
              padding: '10px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.04)',
              color: '#B8B0A0',
              fontSize: '0.75rem',
              fontFamily: 'JetBrains Mono, monospace',
            },
          },
          'Debug: ' + debug
        ),
        React.createElement(
          'p',
          {
            style: {
              textAlign: 'center',
              fontSize: '0.85rem',
              color: '#B8B0A0',
              marginTop: '1.5rem',
            },
          },
          'Need an account? ',
          React.createElement(
            'a',
            {
              href: '/auth/signup',
              style: {
                color: '#C9A84C',
                textDecoration: 'none',
              },
            },
            'Sign Up'
          )
        )
      )
    )
  )
}
=======
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
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
