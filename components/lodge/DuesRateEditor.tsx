'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { notify } from '@/lib/toast'

/**
 * Inline editor for the lodge's annual dues rate.
 *
 * Reads as plain text until clicked, so the Dues page still opens as a
 * ledger rather than a form. Changing the rate is an occasional act;
 * looking at it is constant.
 */
export function DuesRateEditor({ tenantId, current }: { tenantId: string; current: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(current))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/dues/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, duesAmount: value }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not update the rate.')
        notify.error(data.error || 'Could not update the dues rate.')
        return
      }
      setEditing(false)
      notify.saved(`Annual dues set to $${Number(value).toLocaleString()}`)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Could not update the rate.')
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(String(current)); setError(''); setEditing(true) }}
        title="Click to change the annual dues rate"
        style={{
          fontFamily: 'Cinzel, serif', fontSize: '1.7rem', fontWeight: 700, color: T.ink,
          background: 'transparent', border: 'none', borderBottom: `1px dashed ${T.goldBorder}`,
          padding: 0, cursor: 'pointer', lineHeight: 1,
        }}
      >
        ${current.toLocaleString()}
      </button>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', color: T.inkFaint }}>$</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
          style={{
            width: 110, background: T.bg, border: `1px solid ${T.goldBorder}`, color: T.ink,
            padding: '6px 10px', fontFamily: 'Cinzel, serif', fontSize: '1.1rem',
            borderRadius: 4, outline: 'none',
          }}
        />
        <button
          onClick={save}
          disabled={busy}
          style={{ fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.1em', background: T.gold, color: T.bg, border: 'none', padding: '8px 12px', borderRadius: 4, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          {busy ? '…' : 'SAVE'}
        </button>
        <button
          onClick={() => setEditing(false)}
          style={{ fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.1em', background: 'transparent', color: T.inkFaint, border: `1px solid ${T.border}`, padding: '8px 10px', borderRadius: 4, cursor: 'pointer' }}
        >
          ESC
        </button>
      </div>
      {error && <div style={{ color: T.danger, fontSize: '0.78rem', marginTop: 6, maxWidth: 260 }}>{error}</div>}
      <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.8rem', color: T.inkFainter, marginTop: 6, maxWidth: 280, lineHeight: 1.5 }}>
        Changes what outstanding brothers owe. Payments already recorded keep the amount actually received.
      </div>
    </div>
  )
}
