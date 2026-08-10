'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/designTokens'

/**
 * Levying a charge against one brother, from his own profile.
 *
 * The capability already existed — /api/dues/charges has allowed the
 * Treasurer and the Worshipful Master since it was written, and the
 * Dues page has a panel for it. What it did not have was a place on
 * the brother's own record: an officer looking at a man's profile,
 * deciding he owes a re-instatement fee, had to leave, find the Dues
 * page, and pick him out of a dropdown of the whole lodge.
 *
 * Same route, same guards. Nothing about who may do this changes here;
 * this is the missing door onto a room that was already built.
 */

const CHARGE_TYPES: { value: string; label: string }[] = [
  { value: 'penalty', label: 'Penalty' },
  { value: 'late_fee', label: 'Late fee' },
  { value: 'degree_fee', label: 'Degree fee' },
  { value: 'reinstatement', label: 'Reinstatement' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'other', label: 'Other' },
]

export function MemberChargeForm({
  tenantId,
  memberId,
  memberName,
}: {
  tenantId: string
  memberId: string
  memberName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [chargeType, setChargeType] = useState('other')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setDone('')

    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.')
      return
    }
    if (!reason.trim()) {
      // The server enforces this too. Saying it here saves a round trip
      // and repeats the reason why: a brother is entitled to know what
      // he is being charged for.
      setError('A reason is required — a brother is entitled to know what he is being charged for.')
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/dues/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, memberId, amount: value, chargeType, reason: reason.trim() }),
      })
      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { /* handled below */ }

      if (!res.ok) {
        setError(data?.error || `The server returned ${res.status}. Nothing was charged.`)
        return
      }

      setDone(`$${value.toFixed(2)} charged to ${memberName}.`)
      setAmount('')
      setReason('')
      setChargeType('other')
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'That charge could not be recorded.')
    } finally {
      setBusy(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink,
    padding: '9px 12px', fontFamily: T.body, fontSize: '0.9rem', outline: 'none', borderRadius: 4,
  }
  const labelStyle: React.CSSProperties = {
    fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.15em', color: T.gold,
    textTransform: 'uppercase', marginBottom: 5, display: 'block',
  }

  if (!open) {
    return (
      <div>
        <button onClick={() => setOpen(true)} className="btn-outline" style={{ fontSize: '0.66rem', cursor: 'pointer' }}>
          + Add a Charge
        </button>
        {done && <div style={{ color: T.success, fontSize: '0.8rem', marginTop: 8 }}>{done}</div>}
      </div>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
        <div>
          <label style={labelStyle}>Amount</label>
          <input
            type="number" min="0.01" step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="25.00" style={inputStyle} required
          />
        </div>
        <div>
          <label style={labelStyle}>Type</label>
          <select value={chargeType} onChange={e => setChargeType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {CHARGE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Reason</label>
        <input
          value={reason} onChange={e => setReason(e.target.value)}
          placeholder="What this charge is for" style={inputStyle} maxLength={200} required
        />
      </div>

      {error && (
        <div style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid rgba(231,76,60,0.3)', color: T.danger, padding: '8px 12px', fontSize: '0.82rem', borderRadius: 4 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="submit" disabled={busy} className="btn-gold" style={{ fontSize: '0.66rem', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Recording…' : `Charge ${memberName}`}
        </button>
        <button type="button" onClick={() => { setOpen(false); setError('') }} disabled={busy} className="btn-outline" style={{ fontSize: '0.66rem', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}
