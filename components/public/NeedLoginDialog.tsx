'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * "Need a login?" as a popup, on the lodge's own site.
 *
 * WHY THIS EXISTS. The link went to a full page, which was correct and
 * kept being reported as broken — because the chooser dialog on the
 * platform form set the expectation that this link pops up too. Twice
 * reported is not a misunderstanding to explain away; it is the
 * interface disagreeing with the person using it.
 *
 * IT ASKS WHICH KIND OF PERSON YOU ARE FIRST. I argued twice that it
 * should not — we are standing on one lodge's website, so the lodge is
 * known and the question looked like a wasted tap. That reasoning
 * ignored who else reads a lodge's public site: a Mason from another
 * lodge entirely, who is exactly the man worth catching, and who has
 * nowhere else on this page to say so.
 *
 * The full page stays where it is. Anyone arriving from a link, a
 * bookmark or a search still gets it; this is the same request in a
 * dialog for the man who is already reading the lodge's site and does
 * not want to leave it.
 */

export function NeedLoginDialog({
  slug,
  lodgeName,
  className,
  style,
  children,
}: {
  slug: string
  lodgeName: string
  /** Styling comes from whichever place renders it. */
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  /** 'asking' until he says which of the two he is. */
  const [who, setWho] = useState<'asking' | 'brother'>('asking')
  const [mounted, setMounted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    yearsAMember: '', lodgeRole: '', message: '',
  })

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) setOpen(false) }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, busy])

  const set = (key: keyof typeof form) => (e: any) =>
    setForm(p => ({ ...p, [key]: e.target.value }))

  /**
   * Opening starts fresh.
   *
   * Without this, a visitor who sends a request, closes the dialog and
   * opens it again is met with "Sent to the Secretary" and no form —
   * so a second brother on the same phone, or the same man correcting a
   * typo, has no way to send anything. The state of the last request is
   * not the state of the next one.
   */
  const start = () => {
    setWho('asking')
    setSent(false)
    setError('')
    setForm({ firstName: '', lastName: '', email: '', phone: '', yearsAMember: '', lodgeRole: '', message: '' })
    setOpen(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/access-requests/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...form }),
      })
      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { /* handled below */ }
      if (!res.ok) {
        setError(data?.error || 'That could not be sent. Try again in a moment.')
        return
      }
      setSent(true)
    } catch {
      setError('That could not be sent. Check your signal and try again.')
    } finally {
      setBusy(false)
    }
  }

  const input = {
    width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.22)',
    color: '#F5F0E8', padding: '10px 13px', fontFamily: 'Crimson Pro, serif',
    // 16px, or iOS zooms the page the moment a field is tapped.
    fontSize: '16px', outline: 'none', borderRadius: 4, boxSizing: 'border-box' as const,
  }
  const choice: React.CSSProperties = {
    display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
    background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.25)',
    borderRadius: 8, padding: '0.95rem 1.05rem', marginBottom: '0.7rem',
  }
  const choiceTitle: React.CSSProperties = {
    display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.95rem',
    color: '#F5F0E8', marginBottom: 4,
  }
  const choiceBlurb: React.CSSProperties = {
    display: 'block', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem',
    color: '#B8B0A0', lineHeight: 1.5,
  }
  const label = {
    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.16em',
    color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: 5, display: 'block',
  }

  const dialog = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ask ${lodgeName} for a login`}
      onClick={() => { if (!busy) setOpen(false) }}
      style={{
        position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(6,10,17,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="lodgeos-dialog-in"
        style={{
          background: '#141C2E', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 10,
          padding: '1.6rem', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.24em', color: '#C9A84C' }}>
              {who === 'asking' && !sent ? 'BEFORE WE BEGIN' : 'FOR BRETHREN OF THIS LODGE'}
            </div>
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.25rem', color: '#F5F0E8', margin: '5px 0 0' }}>
              {sent ? 'Sent to the Secretary' : who === 'asking' ? 'Which are you?' : 'Ask for a login'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: '#B8B0A0', fontSize: '1.5rem', lineHeight: 1, cursor: 'pointer', padding: '0 4px' }}
          >
            ×
          </button>
        </div>

        {/* THE QUESTION FIRST. A lodge's public site is read by its own
            brethren AND by Masons from elsewhere; the second kind has
            nowhere else on this page to say so. */}
        {!sent && who === 'asking' ? (
          <div style={{ marginTop: '1.1rem' }}>
            <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.98rem', color: '#B8B0A0', lineHeight: 1.6, margin: '0 0 1.1rem' }}>
              These go to two different places.
            </p>

            <button
              type="button"
              onClick={() => setWho('brother')}
              style={choice}
            >
              <span style={choiceTitle}>I am a brother of this lodge</span>
              <span style={choiceBlurb}>
                You are on the roster of {lodgeName} and need a login — or the one you were sent
                never arrived. Your Secretary grants it.
              </span>
            </button>

            <a href="/request-access" style={{ ...choice, display: 'block', textDecoration: 'none' }}>
              <span style={choiceTitle}>I want to enrol my own lodge</span>
              <span style={choiceBlurb}>
                You are asking on behalf of a different lodge that would like to use LodgeOS.
              </span>
            </a>
          </div>
        ) : sent ? (
          <>
            <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1rem', color: '#B8B0A0', lineHeight: 1.65, marginTop: '1rem' }}>
              The Secretary of {lodgeName} has been told. He will send you a sign-in link once he has
              placed you on the roster — nothing here creates an account on its own.
            </p>
            <button
              onClick={() => setOpen(false)}
              className="btn-gold"
              style={{ marginTop: '1rem' }}
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={submit} style={{ marginTop: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#918879', lineHeight: 1.6, margin: 0 }}>
              Already a brother of {lodgeName} and cannot sign in? Your Secretary grants the login —
              this asks him for one.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
              <div>
                <label style={label}>First name</label>
                <input value={form.firstName} onChange={set('firstName')} style={input} maxLength={200} required />
              </div>
              <div>
                <label style={label}>Last name</label>
                <input value={form.lastName} onChange={set('lastName')} style={input} maxLength={200} required />
              </div>
            </div>

            <div>
              <label style={label}>Email</label>
              <input type="email" value={form.email} onChange={set('email')} style={input} maxLength={200} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.7rem' }}>
              <div>
                <label style={label}>Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')} style={input} maxLength={40} />
              </div>
              <div>
                <label style={label}>Raised</label>
                <input value={form.yearsAMember} onChange={set('yearsAMember')} placeholder="2014" style={input} maxLength={40} />
              </div>
            </div>

            <div>
              <label style={label}>Anything the Secretary should know</label>
              <textarea
                value={form.message}
                onChange={set('message')}
                rows={2}
                maxLength={2000}
                style={{ ...input, resize: 'vertical' }}
              />
            </div>

            {error && (
              <p style={{ color: '#EC5B4B', fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem', margin: 0 }}>{error}</p>
            )}

            <button type="submit" disabled={busy} className="btn-gold" style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Sending…' : 'Send to the Secretary'}
            </button>

            {/* The long form is still there for anyone who would rather
                have a page — a bookmark, a shared link, a search result. */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setWho('asking')}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.12em', color: '#918879', textTransform: 'uppercase' }}
              >
                &larr; Back
              </button>
              <a
                href={`/${slug}/request-access`}
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.12em', color: '#918879', textDecoration: 'none', textTransform: 'uppercase' }}
              >
                Open as a full page
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={className}
        aria-haspopup="dialog"
        style={{ background: 'none', border: 'none', font: 'inherit', cursor: 'pointer', color: 'inherit', padding: 0, textAlign: 'left', ...style }}
      >
        {children}
      </button>
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  )
}
