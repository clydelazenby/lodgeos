'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function PublicPetitionPage() {
  const params = useParams()
  const slug = params.slug as string
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', age: '', occupation: '', believes_in_supreme_being: '', reason: '', referred_by: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/petitions/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, ...form }),
    })
    const result = await res.json()

    if (!res.ok) { setError(result.error || 'Something went wrong. Please try again.'); setLoading(false); return }
    setSubmitted(true)
    setLoading(false)
  }

  const inputStyle = { width: '100%', background: '#141C2E', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '11px 15px', fontFamily: 'Crimson Pro, serif', fontSize: '1rem', outline: 'none', borderRadius: '4px', transition: 'border-color 0.2s' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '480px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>✦</div>
          <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: '#C9A84C', marginBottom: '1rem' }}>Petition Received</h2>
          <p style={{ fontSize: '1.1rem', color: '#B8B0A0', lineHeight: 1.7, fontStyle: 'italic', marginBottom: '2rem' }}>
            Your petition has been submitted. A brother will contact you within 7 days to discuss the next steps in your journey.
          </p>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.2em', color: '#C9A84C' }}>LIBERTY · EQUALITY · FRATERNITY</div>
          <Link href={`/${slug}`} style={{ display: 'inline-block', marginTop: '2rem', color: '#B8B0A0', fontFamily: 'Cinzel, serif', fontSize: '0.75rem', textDecoration: 'none', letterSpacing: '0.08em' }}>← Return to Lodge Site</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', padding: '6rem 2rem 4rem' }}>
      <div style={{ maxWidth: '660px', margin: '0 auto' }}>
        <Link href={`/${slug}`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.15em', display: 'block', marginBottom: '2rem' }}>← BACK TO LODGE SITE</Link>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.75rem' }}>BEGIN YOUR JOURNEY</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(2rem, 4vw, 2.8rem)', color: '#F5F0E8', marginBottom: '1rem' }}>Petition for Membership</h1>
        <p style={{ fontSize: '1.05rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '2.5rem', lineHeight: 1.7 }}>All petitions are reviewed by the lodge and treated with complete confidentiality. A brother will contact you within 7 days.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><label style={labelStyle}>First Name *</label><input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} placeholder="John" style={inputStyle} required /></div>
            <div><label style={labelStyle}>Last Name *</label><input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} placeholder="Smith" style={inputStyle} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><label style={labelStyle}>Email *</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" style={inputStyle} required /></div>
            <div><label style={labelStyle}>Phone *</label><input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(919) 000-0000" style={inputStyle} required /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><label style={labelStyle}>Age *</label><input type="number" min="18" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} placeholder="25" style={inputStyle} required /></div>
            <div><label style={labelStyle}>Occupation *</label><input value={form.occupation} onChange={e => setForm(p => ({ ...p, occupation: e.target.value }))} placeholder="Your profession" style={inputStyle} required /></div>
          </div>
          <div>
            <label style={labelStyle}>Do you believe in a Supreme Being? *</label>
            <select value={form.believes_in_supreme_being} onChange={e => setForm(p => ({ ...p, believes_in_supreme_being: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }} required>
              <option value="">Select...</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Why do you wish to become a Freemason? *</label>
            <textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} rows={4} placeholder="In your own words..." style={{ ...inputStyle, resize: 'vertical' }} required />
          </div>
          <div>
            <label style={labelStyle}>Were you referred by a Brother? (optional)</label>
            <input value={form.referred_by} onChange={e => setForm(p => ({ ...p, referred_by: e.target.value }))} placeholder="Brother's name" style={inputStyle} />
          </div>
          {error && <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#E74C3C', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '4px' }}>{error}</div>}
          <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Submitting...' : 'Submit Petition'}
          </button>
        </form>
      </div>
    </div>
  )
}
