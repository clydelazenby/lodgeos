'use client'

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
      setLoading(false)
      return
    }

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
