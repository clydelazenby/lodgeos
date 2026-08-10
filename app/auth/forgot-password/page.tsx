'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * The confirmation deliberately does NOT say whether the address was
 * found — it says "if that address is on file". The route answers
 * identically either way (see app/api/auth/forgot-password), and this
 * page has to match, or the wording gives away what the API was
 * careful not to.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 45000)

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      })

      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { /* handled below */ }

      if (!res.ok) {
        setError(data?.error || `The server returned ${res.status}. Please try again.`)
        return
      }
      setSent(true)
    } catch (err: any) {
      setError(
        err?.name === 'AbortError'
          ? 'That took too long. Please check your connection and try again.'
          : err?.message || 'Something went wrong. Please try again.'
      )
    } finally {
      clearTimeout(deadline)
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '12px 16px', fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', outline: 'none', borderRadius: '4px' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <Link href="/auth/login" style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.2em', textDecoration: 'none' }}>LODGEOS</Link>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', letterSpacing: '0.2em', marginTop: '4px' }}>LODGE MANAGEMENT PLATFORM</p>
        </div>

        <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.2)', padding: '2.5rem', borderRadius: '8px' }}>
          {sent ? (
            <>
              <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#F5F0E8', marginBottom: '0.75rem' }}>Check your email</h1>
              <p style={{ fontSize: '1rem', color: '#B8B0A0', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                If that address is on file, a link to choose a new password is on its way. It can only
                be used once and expires in about an hour.
              </p>
              <p style={{ fontSize: '0.9rem', color: 'rgba(184,176,160,0.65)', lineHeight: 1.7, marginBottom: '1.5rem', fontStyle: 'italic' }}>
                Nothing in your inbox after a few minutes? Check the spam folder, then ask your
                Secretary to confirm which address is on your record.
              </p>
              <Link href="/auth/login" className="btn-gold" style={{ display: 'block', textAlign: 'center', fontSize: '0.68rem' }}>
                Back to Sign In
              </Link>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#F5F0E8', marginBottom: '0.4rem' }}>Forgot your password?</h1>
              <p style={{ fontSize: '0.95rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2rem' }}>
                Enter the email address on your lodge record and we will send you a link to choose a new one.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} required />
                </div>

                {error && (
                  <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#EC5B4B', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '4px' }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem' }}>
                  {loading ? 'Sending link...' : 'Send Reset Link'}
                </button>
              </form>

              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#B8B0A0', marginTop: '1.5rem' }}>
                Remembered it? <Link href="/auth/login" style={{ color: '#C9A84C', textDecoration: 'none' }}>Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
