'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { T } from '@/lib/designTokens'

// ssr:false per the library's own guidance — camera APIs are
// browser-only and rendering this on the server errors.
const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then(m => m.Scanner), { ssr: false })

/**
 * A brother checking HIMSELF in, by scanning the one code displayed
 * for the meeting. The officer-facing twin of this
 * (components/lodge/QrCheckinScanner) scans each member's personal
 * code instead; the two directions post to different routes and are
 * authorized differently.
 *
 * WHY THIS IS A SCANNER AND NOT A BUTTON.
 *
 * A plain "I'm here" button would let a brother mark himself present
 * from his kitchen. The meeting QR is the proof of presence — it is
 * regenerated every time the meeting is opened and nulled when it
 * closes (migration 009), so a screenshot from last month's meeting
 * matches nothing. Attendance is a record the lodge relies on, so the
 * check-in has to cost more than a tap from anywhere.
 */
export function SelfCheckinScanner() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const handleScan = async (results: { rawValue: string }[]) => {
    const scannedMeetingToken = results?.[0]?.rawValue
    if (!scannedMeetingToken || busy || done) return
    setBusy(true)
    setStatus(null)

    try {
      const res = await fetch('/api/attendance/qr-self-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scannedMeetingToken }),
      })

      const raw = await res.text()
      let result: any = null
      try { result = raw ? JSON.parse(raw) : null } catch { /* handled below */ }

      if (!res.ok) {
        setStatus({ type: 'error', text: result?.error || `The server returned ${res.status}. You were not checked in.` })
        return
      }

      setStatus({ type: 'success', text: `✓ You are checked in to ${result?.eventTitle ?? 'the meeting'}.` })
      // Stop scanning once it has worked. Continuing to fire the same
      // code at the server achieves nothing and looks like a failure
      // to the brother holding the phone.
      setDone(true)
    } catch {
      setStatus({ type: 'error', text: 'Check-in failed — check your connection and try again.' })
    } finally {
      setTimeout(() => setBusy(false), 1500)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-gold"
        style={{ fontSize: '0.72rem', cursor: 'pointer' }}
      >
        📷 Scan the Meeting Code
      </button>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontFamily: T.display, fontSize: '0.9rem', color: T.ink }}>Point your camera at the meeting code</span>
        <button onClick={() => setOpen(false)} aria-label="Close scanner" style={{ background: 'none', border: 'none', color: T.inkFaint, cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
      </div>

      {!done && (
        <div style={{ maxWidth: '340px', borderRadius: '8px', overflow: 'hidden' }}>
          <Scanner onScan={handleScan} formats={['qr_code']} />
        </div>
      )}

      {status && (
        <div style={{
          marginTop: '10px', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem',
          background: status.type === 'success' ? 'rgba(93,190,133,0.12)' : 'rgba(231,76,60,0.12)',
          color: status.type === 'success' ? T.success : T.danger,
          border: `1px solid ${status.type === 'success' ? 'rgba(93,190,133,0.3)' : 'rgba(231,76,60,0.3)'}`,
        }}>{status.text}</div>
      )}

      <p style={{ color: T.inkFainter, fontSize: '0.75rem', fontStyle: 'italic', marginTop: '10px', marginBottom: 0 }}>
        Requires camera permission. The code only works while the meeting is open — if it is refused, ask
        an officer whether the meeting has been opened yet.
      </p>
    </div>
  )
}
