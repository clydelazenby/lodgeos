'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * Where /start's call to action now leads, in place of self-serve
 * signup. A lodge asks; the platform owner decides and onboards them.
 * Nothing on this page creates an account.
 */
export default function RequestAccessPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    lodgeName: '', lodgeNumber: '', jurisdiction: '',
    contactName: '', contactRole: '', contactEmail: '', contactPhone: '',
    memberCount: '', message: '',
  })

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 45000)

    try {
      const res = await fetch('/api/access-requests/platform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        signal: controller.signal,
      })
      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { /* handled below */ }

      if (!res.ok) {
        setError(data?.error || `The server returned ${res.status}. Your request was not submitted.`)
        return
      }
      setSubmitted(true)
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

  const inputStyle = { width: '100%', background: '#141C2E', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '11px 15px', fontFamily: 'Crimson Pro, serif', fontSize: '1.1rem', outline: 'none', borderRadius: '4px' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>✦</div>
          <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: '#C9A84C', marginBottom: '1rem' }}>Request Received</h2>
          <p style={{ fontSize: '1.1rem', color: '#B8B0A0', lineHeight: 1.7, fontStyle: 'italic', marginBottom: '2rem' }}>
            Thank you. We will review your request and be in touch by email within two business days
            to arrange your lodge&apos;s setup.
          </p>
          <Link href="/start" style={{ display: 'inline-block', color: '#B8B0A0', fontFamily: 'Cinzel, serif', fontSize: '0.75rem', textDecoration: 'none', letterSpacing: '0.08em' }}>← Return to LodgeOS</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', padding: '6rem 2rem 4rem' }}>
      <div style={{ maxWidth: '660px', margin: '0 auto' }}>
        <Link href="/start" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.15em', display: 'block', marginBottom: '2rem' }}>← BACK TO LODGEOS</Link>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.75rem' }}>FOR LODGES</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(2rem, 4vw, 2.8rem)', color: '#F5F0E8', marginBottom: '1rem' }}>Request Access</h1>
        <p style={{ fontSize: '1.05rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2.5rem', lineHeight: 1.7 }}>
          LodgeOS is set up for each lodge individually. Tell us about yours and we will be in touch
          within two business days to arrange it.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div>
              <label className="lodgeos-required" style={labelStyle}>Lodge Name</label>
              <input value={form.lodgeName} onChange={set('lodgeName')} placeholder="Psalms of Job" style={inputStyle} maxLength={200} required />
            </div>
            <div>
              <label style={labelStyle}>Number</label>
              <input value={form.lodgeNumber} onChange={set('lodgeNumber')} placeholder="1827" style={inputStyle} maxLength={40} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Grand Lodge / Jurisdiction</label>
            <input value={form.jurisdiction} onChange={set('jurisdiction')} placeholder="MWPHGL of Texas" style={inputStyle} maxLength={200} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="lodgeos-required" style={labelStyle}>Your Name</label>
              <input value={form.contactName} onChange={set('contactName')} placeholder="John Smith" style={inputStyle} maxLength={200} required />
            </div>
            <div>
              <label style={labelStyle}>Your Office</label>
              <input value={form.contactRole} onChange={set('contactRole')} placeholder="Secretary" style={inputStyle} maxLength={200} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="lodgeos-required" style={labelStyle}>Email</label>
              <input type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="secretary@lodge.com" style={inputStyle} maxLength={200} required />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={form.contactPhone} onChange={set('contactPhone')} placeholder="(555) 123-4567" style={inputStyle} maxLength={40} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Roughly How Many Members</label>
            <input type="number" min={0} value={form.memberCount} onChange={set('memberCount')} placeholder="40" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Anything Else</label>
            <textarea value={form.message} onChange={set('message')} rows={4} maxLength={2000} placeholder="What you are hoping LodgeOS will help with." style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'Crimson Pro, serif' }} />
          </div>

          {error && (
            <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#EC5B4B', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-gold" style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem' }}>
            {loading ? 'Sending request...' : 'Submit Request'}
          </button>

          <p style={{ fontSize: '0.82rem', color: 'rgba(184,176,160,0.6)', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
            Already set up? <Link href="/auth/login" style={{ color: '#C9A84C', textDecoration: 'none' }}>Sign in</Link>.
          </p>
        </form>
      </div>
    </div>
  )
}
