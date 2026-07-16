'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { T } from '@/lib/designTokens'

// Dynamically imported with ssr:false per the library's own documented
// guidance — it uses browser-only camera APIs and will not work (and
// will error) if Next.js attempts to render it on the server.
const Scanner = dynamic(() => import('@yudiel/react-qr-scanner').then(m => m.Scanner), { ssr: false })

export function QrCheckinScanner({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const handleScan = async (results: { rawValue: string }[]) => {
    const scannedToken = results?.[0]?.rawValue
    if (!scannedToken || busy) return
    setBusy(true)
    setStatus(null)

    try {
      const res = await fetch('/api/attendance/qr-checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, scannedToken }),
      })
      const result = await res.json()
      if (!res.ok) {
        setStatus({ type: 'error', text: result.error })
      } else {
        setStatus({ type: 'success', text: `✓ ${result.memberName} checked in to ${result.eventTitle}` })
      }
    } catch {
      setStatus({ type: 'error', text: 'Scan failed — check your connection and try again.' })
    } finally {
      // Brief cooldown before allowing the next scan, so the same code
      // held in front of the camera doesn't fire a dozen requests in a
      // row before the officer moves it away.
      setTimeout(() => setBusy(false), 1500)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ background: T.gold, color: T.bg, border: 'none', padding: '10px 22px', borderRadius: '6px', fontFamily: T.display, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
        📷 Scan Member QR
      </button>
    )
  }

  return (
    <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontFamily: T.display, fontSize: '0.9rem', color: T.ink }}>Scan Member QR</span>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: T.inkFaint, cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
      </div>
      <div style={{ maxWidth: '340px', borderRadius: '8px', overflow: 'hidden' }}>
        <Scanner onScan={handleScan} formats={['qr_code']} />
      </div>
      {status && (
        <div style={{
          marginTop: '10px', padding: '8px 14px', borderRadius: '6px', fontSize: '0.82rem',
          background: status.type === 'success' ? 'rgba(93,190,133,0.12)' : 'rgba(231,76,60,0.12)',
          color: status.type === 'success' ? T.success : T.danger,
          border: `1px solid ${status.type === 'success' ? 'rgba(93,190,133,0.3)' : 'rgba(231,76,60,0.3)'}`,
        }}>{status.text}</div>
      )}
      <p style={{ color: T.inkFainter, fontSize: '0.75rem', fontStyle: 'italic', marginTop: '10px', marginBottom: 0 }}>
        Requires HTTPS (or localhost) and camera permission. A meeting must be open in Meeting Mode before scans will succeed.
      </p>
    </div>
  )
}
