'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Where an invitation link lands, and where a password reset link
 * lands (?mode=reset). app/auth/callback verifies either token and
 * sends the brother here with a session already established.
 *
 * An invited brother has an account but has never chosen a password —
 * nobody set one for him. Before this page existed the invite link
 * could only drop him straight into the portal on a session he was
 * unable to re-establish the moment he signed out or the session
 * expired. The two flows share this page because they end in the same
 * act: he picks a password and goes to the portal.
 */
export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  // Both an invitation and a password reset land here, and the wording
  // should match which one the brother just followed. Read after mount
  // for the same reason the login page does — the server has no query
  // string to render from.
  const [isReset, setIsReset] = useState(false)

  useEffect(() => {
    setIsReset(new URLSearchParams(window.location.search).get('mode') === 'reset')
  }, [])

  // The Supabase client is built inside the browser-only paths rather
  // than in the component body on purpose: this route is static, so
  // Next prerenders it at build time, and constructing a client there
  // makes the BUILD depend on NEXT_PUBLIC_SUPABASE_URL being present.
  // Nothing on this page needs a client before it is interactive.

  // The callback verified the token and wrote the session cookie before
  // redirecting here. If there is no session the link was opened in a
  // different browser than it was verified in, or it has since been
  // signed out — either way there is nothing to set a password on.
  useEffect(() => {
    // Read the mode straight from the URL rather than depending on the
    // isReset state: that state is false on the first render and flips
    // in its own effect, so depending on it would run this check twice
    // and could redirect with the wrong message before it settled.
    const mode = new URLSearchParams(window.location.search).get('mode')
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.replace(`/auth/login?error=${mode === 'reset' ? 'reset_expired' : 'link_expired'}`)
        return
      }
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Those passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password })
      if (updateError) {
        setError(updateError.message)
        return
      }
      // Full navigation so the portal's server components render against
      // the session cookie on their first pass, matching the login page.
      window.location.replace('/portal')
    } catch (err: any) {
      setError(err?.message || 'Something went wrong setting your password.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '12px 16px', fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', outline: 'none', borderRadius: '4px' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.2em' }}>LODGEOS</div>
          <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', letterSpacing: '0.2em', marginTop: '4px' }}>{isReset ? 'CHOOSE A NEW PASSWORD' : 'SET UP YOUR PORTAL ACCESS'}</p>
        </div>

        <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.2)', padding: '2.5rem', borderRadius: '8px' }}>
          {checking ? (
            <p style={{ color: '#B8B0A0', fontFamily: 'Crimson Pro, serif', textAlign: 'center', margin: 0 }}>
              {isReset ? 'Verifying your reset link...' : 'Verifying your invitation...'}
            </p>
          ) : (
            <>
              <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.2rem', color: '#F5F0E8', marginBottom: '0.4rem' }}>{isReset ? 'Choose a new password' : 'Choose a password'}</h1>
              <p style={{ fontSize: '0.95rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2rem' }}>
                {isReset
                  ? 'Your old password stops working as soon as you save this one.'
                  : 'This is what you will sign in with from now on.'}
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} minLength={8} required />
                </div>
                <div>
                  <label style={labelStyle}>Confirm Password</label>
                  <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Re-enter your password" style={inputStyle} minLength={8} required />
                </div>
                {error && (
                  <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#EC5B4B', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '4px' }}>
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem' }}>
                  {loading ? 'Saving...' : 'Save & Enter the Portal →'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
