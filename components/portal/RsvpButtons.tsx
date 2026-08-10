'use client'

import { useState } from 'react'

/**
 * Answering an invitation from the portal.
 *
 * The same three answers the invitation email offers, so a brother who
 * has lost the email is not stuck — see app/api/rsvp/portal for why
 * that needed its own route rather than reusing the email's token.
 */
export function RsvpButtons({
  eventId,
  current,
}: {
  eventId: string
  current?: 'yes' | 'no' | 'maybe' | null
}) {
  const [answer, setAnswer] = useState<string | null>(current ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const choose = async (response: 'yes' | 'no' | 'maybe') => {
    if (busy) return
    const previous = answer
    setBusy(true)
    setError('')
    // Optimistic: these are three buttons and should feel instant.
    setAnswer(response)

    try {
      const res = await fetch('/api/rsvp/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, response }),
      })
      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { /* handled below */ }
      if (!res.ok) throw new Error(data?.error || `The server returned ${res.status}.`)
    } catch (err: any) {
      // Put the old answer back rather than leaving him looking at one
      // that was never recorded.
      setAnswer(previous)
      setError(err?.message || 'Your answer could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const OPTIONS: { value: 'yes' | 'maybe' | 'no'; label: string; color: string }[] = [
    { value: 'yes', label: 'Attending', color: '#5DBE85' },
    { value: 'maybe', label: 'Maybe', color: '#C9A84C' },
    { value: 'no', label: "Can't make it", color: '#EC5B4B' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {OPTIONS.map(o => {
          const active = answer === o.value
          return (
            <button
              key={o.value}
              onClick={() => choose(o.value)}
              disabled={busy}
              aria-pressed={active}
              style={{
                background: active ? o.color : 'transparent',
                color: active ? '#0A0E1A' : o.color,
                border: `1px solid ${o.color}`,
                borderRadius: 4,
                fontFamily: 'Cinzel, serif',
                fontSize: '0.62rem',
                letterSpacing: '0.05em',
                padding: '6px 12px',
                cursor: busy ? 'wait' : 'pointer',
                opacity: busy ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {error && (
        <div style={{ color: '#EC5B4B', fontSize: '0.7rem', marginTop: 6 }}>{error}</div>
      )}
    </div>
  )
}
