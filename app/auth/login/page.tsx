'use client'

import React, { useState, useEffect } from 'react'

// app/auth/callback redirects here with ?error=… when an emailed link
// cannot be exchanged for a session. Without this the brother lands on
// a blank login form with no idea why, and no password to try.
const LINK_ERRORS: Record<string, string> = {
  link_expired:
    'That invitation link has expired or was already used. Ask your Secretary to send you a new invitation.',
  reset_expired:
    'That password reset link has expired or was already used. Request a new one below.',
  auth_failed: 'That sign-in link could not be verified. Please sign in below or request a new invitation.',
}

/**
 * ONLY A PATH ON THIS SITE.
 *
 * `next` arrives in a URL and a URL can be edited by anyone who sends
 * one, so it is treated as untrusted. Anything absolute, protocol-
 * relative ("//evil.example") or backslash-mangled is dropped rather
 * than corrected — a sign-in page that will forward to another host on
 * request is a phishing tool, and this one is emailed to brethren.
 */
function safeNext(value: string | null): string | null {
  if (!value) return null
  if (!value.startsWith('/')) return null
  if (value.startsWith('//') || value.startsWith('/\\')) return null
  if (value.includes('\\')) return null
  return value
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [next, setNext] = useState<string | null>(null)

  // Read after mount rather than during render — the server has no
  // query string to render from, and a mismatch would hydrate away.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const reason = params.get('error')
    if (reason && LINK_ERRORS[reason]) setError(LINK_ERRORS[reason])
    setNext(safeNext(params.get('next')))
  }, [])

 const handleLogin = async function (event: any) {
  event.preventDefault()

  setLoading(true)
  setError('')

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

    if (!res.ok) {
      setError(result.error || 'Login failed.')
      setLoading(false)
      return
    }

    // Full document navigation rather than router.push, so the new
    // session cookie is attached to a fresh request to the destination
    // and its server component tree renders authenticated on the first
    // pass. replace() also keeps the login page out of history.
    // Where he was actually going, if middleware recorded one; the
    // route's own idea of home otherwise.
    window.location.replace(next || result.redirectTo || '/portal')
  } catch (err: any) {
    console.error('Login request failed:', err)
    setError(err?.message || 'Something went wrong signing in.')
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
                    color: '#EC5B4B',
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
        // Directly under the form, where a brother looks the moment a
        // password fails — not buried at the bottom of the page.
        React.createElement(
          'p',
          {
            style: {
              textAlign: 'center',
              fontSize: '0.85rem',
              marginTop: '1.25rem',
            },
          },
          React.createElement(
            'a',
            {
              href: '/auth/forgot-password',
              style: {
                color: '#C9A84C',
                textDecoration: 'none',
              },
            },
            'Forgot your password?'
          )
        ),
        React.createElement(
          'p',
          {
            style: {
              textAlign: 'center',
              fontSize: '0.85rem',
              color: '#B8B0A0',
              marginTop: '0.75rem',
            },
          },
          // Self-serve signup is no longer offered here: a lodge asks
          // for access and is onboarded, and a brother is invited by
          // his Secretary. Both paths start with a request, not an
          // account. /auth/signup still exists for onboarding an
          // approved lodge — it is simply no longer advertised.
          'Need an account? ',
          React.createElement(
            'a',
            {
              href: '/request-access',
              style: {
                color: '#C9A84C',
                textDecoration: 'none',
              },
            },
            'Request Access'
          ),
          // What the link actually leads to, in the six words that
          // would have stopped a Senior Warden signing his own lodge
          // up for a second time. The chooser behind it is the real
          // fix; this is the label that should always have been here.
          React.createElement(
            'div',
            {
              style: {
                fontSize: '0.78rem',
                color: '#918879',
                marginTop: '0.4rem',
                fontStyle: 'italic',
              },
            },
            'A brother gets his login from his own Secretary — start here and we will point you at him.'
          )
        )
      )
    )
  )
}
