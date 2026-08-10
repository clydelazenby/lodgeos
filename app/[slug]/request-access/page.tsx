'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

/** How long the confirmation sits before the lodge's site takes over. */
const RETURN_DELAY_SECONDS = 6

/**
 * For a brother of the lodge who has no portal login yet.
 *
 * Distinct from the petition form next door, which is for men seeking
 * to BECOME Masons. This one assumes the man is already a brother and
 * simply has no account — the gap the Members page invite fills from
 * the other side.
 *
 * Nothing here grants access. It reaches the Secretary, who knows
 * whether the name is really on the roster.
 */
export default function PortalAccessRequestPage() {
  const params = useParams()
  const slug = params.slug as string
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    yearsAMember: '', lodgeRole: '', message: '',
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
      const res = await fetch('/api/access-requests/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...form }),
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
    return <RequestSentNotice slug={slug} />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', padding: '6rem 2rem 4rem' }}>
      <div style={{ maxWidth: '660px', margin: '0 auto' }}>
        <Link href={`/${slug}`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', textDecoration: 'none', letterSpacing: '0.15em', display: 'block', marginBottom: '2rem' }}>← BACK TO LODGE SITE</Link>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.3em', color: '#C9A84C', marginBottom: '0.75rem' }}>FOR BRETHREN OF THIS LODGE</div>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: 'clamp(2rem, 4vw, 2.8rem)', color: '#F5F0E8', marginBottom: '1rem' }}>Request Portal Access</h1>
        <p style={{ fontSize: '1.05rem', color: '#B8B0A0', fontStyle: 'italic', marginBottom: '1rem', lineHeight: 1.7 }}>
          For brothers of this lodge who do not yet have a login. The Secretary will confirm you on
          the roster and send your invitation.
        </p>
        <p style={{ fontSize: '0.95rem', color: 'rgba(184,176,160,0.65)', marginBottom: '2.5rem', lineHeight: 1.7 }}>
          Not yet a Mason? <Link href={`/${slug}/petition`} style={{ color: '#C9A84C', textDecoration: 'none' }}>Petition for membership</Link> instead.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="lodgeos-required" style={labelStyle}>First Name</label>
              <input value={form.firstName} onChange={set('firstName')} placeholder="John" style={inputStyle} maxLength={200} required />
            </div>
            <div>
              <label className="lodgeos-required" style={labelStyle}>Last Name</label>
              <input value={form.lastName} onChange={set('lastName')} placeholder="Smith" style={inputStyle} maxLength={200} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="lodgeos-required" style={labelStyle}>Email</label>
              <input type="email" value={form.email} onChange={set('email')} placeholder="you@email.com" style={inputStyle} maxLength={200} required />
              <p style={{ fontSize: '0.78rem', color: 'rgba(184,176,160,0.6)', fontStyle: 'italic', marginTop: 4 }}>
                Your invitation will be sent here.
              </p>
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(555) 123-4567" style={inputStyle} maxLength={40} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Years a Member</label>
              <input value={form.yearsAMember} onChange={set('yearsAMember')} placeholder="Raised 2014" style={inputStyle} maxLength={40} />
            </div>
            <div>
              <label style={labelStyle}>Office, If Any</label>
              <input value={form.lodgeRole} onChange={set('lodgeRole')} placeholder="Senior Deacon" style={inputStyle} maxLength={200} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Anything the Secretary Should Know</label>
            <textarea value={form.message} onChange={set('message')} rows={4} maxLength={2000} placeholder="Anything that helps him place you on the roster." style={{ ...inputStyle, resize: 'vertical' as const, fontFamily: 'Crimson Pro, serif' }} />
          </div>

          {error && (
            <div style={{ background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.3)', color: '#EC5B4B', padding: '10px 14px', fontSize: '0.9rem', borderRadius: '4px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-gold" style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.5rem' }}>
            {loading ? 'Sending request...' : 'Send Request to the Secretary'}
          </button>

          <p style={{ fontSize: '0.82rem', color: 'rgba(184,176,160,0.6)', fontStyle: 'italic', textAlign: 'center', margin: 0 }}>
            Already have a login? <Link href="/auth/login" style={{ color: '#C9A84C', textDecoration: 'none' }}>Sign in</Link>.
          </p>
        </form>
      </div>
    </div>
  )
}

/**
 * Confirmation, then back to the lodge's own site.
 *
 * A brother who came from his lodge's website should end up back on it,
 * not marooned on a LodgeOS page. LodgeOS is the tool the lodge uses;
 * from his side it should be invisible, and the last thing he sees
 * should be the lodge's own site rather than the platform's.
 *
 * The redirect is on a timer rather than immediate so he can actually
 * read what happens next, and there is a link for anyone who would
 * rather not wait — the countdown never traps someone who has
 * navigation disabled or who reads slowly.
 */
function RequestSentNotice({ slug }: { slug: string }) {
  const [remaining, setRemaining] = useState(RETURN_DELAY_SECONDS)

  useEffect(() => {
    const tick = setInterval(() => setRemaining((n) => n - 1), 1000)
    const go = setTimeout(() => window.location.assign(`/${slug}`), RETURN_DELAY_SECONDS * 1000)
    return () => { clearInterval(tick); clearTimeout(go) }
  }, [slug])

  return (
    <div style={{ minHeight: '100vh', background: '#0A0E1A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
      <div style={{ maxWidth: '480px' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem' }}>✦</div>
        <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.8rem', color: '#C9A84C', marginBottom: '1rem' }}>Request Sent</h2>
        <p style={{ fontSize: '1.1rem', color: '#B8B0A0', lineHeight: 1.7, fontStyle: 'italic', marginBottom: '2rem' }}>
          The Secretary has been notified. Once he confirms you on the roster you will receive an
          invitation by email with a link to set up your portal.
        </p>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.2em', color: '#C9A84C' }}>LIBERTY · EQUALITY · FRATERNITY</div>
        <div style={{ marginTop: '2rem' }}>
          <Link href={`/${slug}`} className="btn-gold" style={{ fontSize: '0.68rem' }}>Return to Lodge Site</Link>
        </div>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.14em', color: 'rgba(184,176,160,0.5)', marginTop: '1rem' }}>
          {remaining > 0 ? `RETURNING IN ${remaining}…` : 'RETURNING…'}
        </p>
      </div>
    </div>
  )
}
