'use client'
import { useState } from 'react'

/**
 * The one-time act that replaces a monthly one.
 *
 * A brother adds this URL to his phone once and the lodge's whole
 * schedule appears there and stays current — a meeting moved on Tuesday
 * moves in his pocket on Tuesday. The per-event download it supplements
 * required a fresh link, sent and tapped, for every single meeting.
 *
 * WHY BOTH A webcal: AND AN https: FORM. webcal:// is not a real
 * protocol — it is a convention every calendar client registers a
 * handler for, so tapping it on a phone opens Calendar with a
 * subscribe prompt instead of downloading a file into the browser. It
 * is the right thing to tap. But it is useless pasted into Google
 * Calendar's "add by URL" box on the desktop, which wants https. So:
 * a button for the tap, and the https text for the paste.
 */
export function CalendarSubscribe({ token, compact = false }: { token: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false)

  // Built in the browser rather than passed in, so it is right on
  // localhost, on a preview deployment and in production without the
  // app having to be told which it is.
  const httpsUrl =
    typeof window === 'undefined' ? '' : `${window.location.origin}/api/calendar/${token}/lodge.ics`
  const webcalUrl = httpsUrl.replace(/^https?:/, 'webcal:')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused; the URL is on screen and
      // selectable either way.
    }
  }

  return (
    <div style={{ padding: compact ? '0.9rem 1.4rem' : '1.2rem 1.4rem' }}>
      {!compact && (
        <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#B8B0A0', margin: '0 0 0.9rem' }}>
          Subscribe once and every meeting, degree night and festive board appears in your calendar
          — including changes made later. This is the lodge&apos;s whole schedule, so treat the link
          as you would the trestleboard: for the brethren, not for posting publicly.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <a
          href={webcalUrl}
          className="btn-gold"
          style={{ fontSize: '0.68rem', textDecoration: 'none', display: 'inline-block' }}
        >
          Add to my calendar
        </a>
        <button
          onClick={copy}
          style={{
            background: 'transparent',
            border: `1px solid ${copied ? 'rgba(93,190,133,0.5)' : 'rgba(201,168,76,0.25)'}`,
            color: copied ? '#5DBE85' : '#C9A84C',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.58rem',
            letterSpacing: '0.12em',
            padding: '9px 12px',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          {copied ? '✓ COPIED' : 'COPY LINK'}
        </button>
      </div>

      <div
        style={{
          marginTop: '0.8rem',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.6rem',
          color: '#918879',
          background: '#0A0E1A',
          border: '1px solid rgba(201,168,76,0.12)',
          padding: '8px 10px',
          borderRadius: 3,
          overflowWrap: 'anywhere',
        }}
      >
        {httpsUrl || '…'}
      </div>

      {!compact && (
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.88rem', color: '#918879', margin: '0.7rem 0 0' }}>
          On a phone, use the button. On a computer, paste the address into Google Calendar&apos;s
          &ldquo;Other calendars → From URL&rdquo; or Outlook&apos;s &ldquo;Subscribe from
          web&rdquo;. Do not use &ldquo;import&rdquo; — an import is a one-time copy that never
          updates again.
        </p>
      )}
    </div>
  )
}
