'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { T } from '@/lib/designTokens'

/**
 * Penalties, fines and one-off fees.
 *
 * Kept visually distinct from the dues table above it, because these
 * are different obligations with different lifecycles: dues are one
 * annual rate every brother owes, a charge is a specific amount levied
 * on one brother for a stated reason, and unlike dues it can be waived.
 */

const TYPE_LABEL: Record<string, string> = {
  penalty: 'Penalty',
  late_fee: 'Late Fee',
  degree_fee: 'Degree Fee',
  reinstatement: 'Reinstatement',
  assessment: 'Assessment',
  other: 'Other',
}

type Member = { user_id: string; profiles: { first_name: string | null; last_name: string | null } | null }
type Charge = {
  id: string; member_id: string; amount: number; charge_type: string; reason: string
  status: string; created_at: string; due_date: string | null; waived_reason: string | null
  profiles?: { first_name: string | null; last_name: string | null } | null
}

export function ChargesPanel({
  tenantId,
  members,
  charges,
}: {
  tenantId: string
  members: Member[]
  charges: Charge[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [waivingId, setWaivingId] = useState<string | null>(null)
  const [waiveReason, setWaiveReason] = useState('')
  const [form, setForm] = useState({
    memberId: '', amount: '', chargeType: 'penalty', reason: '', dueDate: '',
  })

  const outstanding = charges.filter(c => c.status === 'outstanding')
  const outstandingTotal = outstanding.reduce((a, c) => a + Number(c.amount), 0)

  const nameOf = (c: Charge) => {
    const p = c.profiles ?? members.find(m => m.user_id === c.member_id)?.profiles
    return `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Unknown'
  }

  const levy = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/dues/charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not add that charge.'); return }
      setForm({ memberId: '', amount: '', chargeType: 'penalty', reason: '', dueDate: '' })
      setShowForm(false)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Could not add that charge.')
    } finally {
      setBusy(false)
    }
  }

  const update = async (chargeId: string, action: 'waive' | 'mark_paid' | 'reopen', reason?: string) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/dues/charges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, chargeId, action, waivedReason: reason }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not update that charge.'); return }
      setWaivingId(null)
      setWaiveReason('')
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Could not update that charge.')
    } finally {
      setBusy(false)
    }
  }

  const input = {
    width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink,
    padding: '9px 12px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem',
    outline: 'none', borderRadius: 4, boxSizing: 'border-box' as const,
  }
  const label = {
    fontFamily: T.mono, fontSize: '0.56rem', letterSpacing: '0.2em', color: T.gold,
    textTransform: 'uppercase' as const, marginBottom: 5, display: 'block',
  }
  const ghost = {
    fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    background: 'transparent', border: `1px solid ${T.goldBorder}`, color: T.gold,
    padding: '5px 11px', borderRadius: 3, cursor: 'pointer',
  }

  return (
    <div className="data-box">
      <div className="data-box-head">
        <span>
          Penalties &amp; Fees
          {outstanding.length > 0 && (
            <span style={{ fontFamily: T.mono, fontSize: '0.62rem', color: T.danger, marginLeft: 10 }}>
              ${outstandingTotal.toLocaleString()} outstanding
            </span>
          )}
        </span>
        <button onClick={() => { setError(''); setShowForm(v => !v) }} style={ghost}>
          {showForm ? 'Cancel' : '+ Add Charge'}
        </button>
      </div>

      {error && (
        <div style={{ margin: '1rem 1.4rem', background: T.dangerDim, border: '1px solid rgba(231,76,60,0.3)', color: T.danger, padding: '10px 14px', borderRadius: 4, fontFamily: 'Crimson Pro, serif' }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={levy} style={{ padding: '1.4rem', borderBottom: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={label}>Brother</label>
            <select value={form.memberId} onChange={e => setForm(p => ({ ...p, memberId: e.target.value }))} required style={{ ...input, cursor: 'pointer' }}>
              <option value="">— Select —</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.profiles?.first_name} {m.profiles?.last_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Amount</label>
            <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="25.00" required style={input} />
          </div>
          <div>
            <label style={label}>Type</label>
            <select value={form.chargeType} onChange={e => setForm(p => ({ ...p, chargeType: e.target.value }))} style={{ ...input, cursor: 'pointer' }}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Due By (optional)</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} style={input} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Reason</label>
            <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="e.g. Late dues penalty, 2026" required style={input} />
            <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.82rem', color: T.inkFainter, fontStyle: 'italic', margin: '6px 0 0' }}>
              Shown to the brother. A charge he cannot see the reason for is one he cannot answer.
            </p>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" disabled={busy} className="btn-gold" style={{ fontSize: '0.68rem', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Adding…' : 'Add Charge'}
            </button>
          </div>
        </form>
      )}

      {charges.length === 0 ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: T.inkFaint, fontStyle: 'italic' }}>
          No penalties or fees recorded.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Brother', 'Reason', 'Type', 'Amount', 'Status', ''].map((h, i) => <th key={h || `c${i}`} className="dash-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {charges.map(c => (
              <tr key={c.id}>
                <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>Bro. {nameOf(c)}</td>
                <td className="dash-td" style={{ fontSize: '0.88rem' }}>
                  {c.reason}
                  <div style={{ fontFamily: T.mono, fontSize: '0.58rem', color: T.inkFainter, marginTop: 2 }}>
                    {format(new Date(c.created_at), 'MMM d, yyyy')}
                    {c.due_date && ` · due ${format(new Date(c.due_date + 'T12:00:00'), 'MMM d')}`}
                  </div>
                  {c.status === 'waived' && c.waived_reason && (
                    <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.8rem', color: T.inkFainter, fontStyle: 'italic', marginTop: 3 }}>
                      Waived — {c.waived_reason}
                    </div>
                  )}
                </td>
                <td className="dash-td"><span className="pill pill-ea">{TYPE_LABEL[c.charge_type] ?? c.charge_type}</span></td>
                <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: c.status === 'outstanding' ? T.danger : T.inkFaint, whiteSpace: 'nowrap' }}>
                  ${Number(c.amount).toLocaleString()}
                </td>
                <td className="dash-td">
                  <span className={`pill ${c.status === 'paid' ? 'pill-active' : c.status === 'waived' ? 'pill-fc' : 'pill-new'}`}>{c.status}</span>
                </td>
                <td className="dash-td" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.status === 'outstanding' ? (
                    waivingId === c.id ? (
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <input
                          value={waiveReason}
                          onChange={e => setWaiveReason(e.target.value)}
                          placeholder="Reason for waiving"
                          autoFocus
                          style={{ ...input, width: 170, padding: '5px 9px', fontSize: '0.85rem' }}
                        />
                        <button onClick={() => update(c.id, 'waive', waiveReason)} disabled={busy || !waiveReason.trim()} style={{ ...ghost, opacity: waiveReason.trim() ? 1 : 0.4 }}>Confirm</button>
                        <button onClick={() => { setWaivingId(null); setWaiveReason('') }} style={{ ...ghost, borderColor: T.border, color: T.inkFaint }}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                        <button onClick={() => update(c.id, 'mark_paid')} disabled={busy} style={ghost}>Mark Paid</button>
                        <button onClick={() => { setWaiveReason(''); setWaivingId(c.id) }} style={{ ...ghost, borderColor: T.border, color: T.inkFaint }}>Waive</button>
                      </div>
                    )
                  ) : (
                    <button onClick={() => update(c.id, 'reopen')} disabled={busy} style={{ ...ghost, borderColor: T.border, color: T.inkFaint }}>Reopen</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
