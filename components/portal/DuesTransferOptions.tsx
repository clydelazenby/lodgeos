'use client'

import { useState } from 'react'
import { T } from '@/lib/designTokens'
import { notify } from '@/lib/toast'

/**
 * Paying dues by Zelle, Cash App or Venmo.
 *
 * Cash App and Venmo take the amount in the URL, so the brother lands
 * in the app with $60 already entered. Zelle has no such link — it
 * lives inside each bank's own app — so its details are shown to copy,
 * with the account name to check before sending, because a Zelle
 * transfer cannot be reversed.
 *
 * The "I've sent it" step is not a formality. Nothing tells this app
 * that a transfer arrived, so the brother's report and the Treasurer's
 * confirmation are two halves of one record. Pressing this does NOT
 * mark him paid — it puts him in the Treasurer's queue, and the button
 * says so rather than implying the matter is closed.
 */
export function DuesTransferOptions({
  tenantId,
  lodgeName,
  amount,
  year,
  cashapp,
  venmo,
  zelle,
  zelleName,
  alreadyReported,
}: {
  tenantId: string
  lodgeName: string
  amount: number
  year: number
  cashapp: string | null
  venmo: string | null
  zelle: string | null
  zelleName: string | null
  alreadyReported: boolean
}) {
  const [method, setMethod] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [reported, setReported] = useState(alreadyReported)
  const [copied, setCopied] = useState(false)

  const hasAny = Boolean(cashapp || venmo || zelle)
  if (!hasAny) return null

  const note_ = `${lodgeName} dues ${year}`
  const cashappUrl = cashapp ? `https://cash.app/$${encodeURIComponent(cashapp)}/${amount}` : null
  const venmoUrl = venmo
    ? `https://venmo.com/u/${encodeURIComponent(venmo)}?txn=pay&amount=${amount}&note=${encodeURIComponent(note_)}`
    : null

  const report = async () => {
    if (!method) return
    setBusy(true)
    try {
      const res = await fetch('/api/dues/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, method, year, referenceNote: note }),
      })
      const data = await res.json()
      if (!res.ok) {
        notify.error(data.error || 'Could not record that.')
        return
      }
      setReported(true)
      notify.saved(data.message || 'Reported to the Treasurer.')
    } catch (err: any) {
      notify.error(err?.message || 'Could not record that.')
    } finally {
      setBusy(false)
    }
  }

  const card = {
    background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 6, padding: '1rem', marginBottom: '0.75rem',
  }
  const label = {
    fontFamily: T.mono, fontSize: '0.56rem', letterSpacing: '0.2em',
    color: T.gold, textTransform: 'uppercase' as const, marginBottom: 6, display: 'block',
  }
  const payLink = {
    display: 'block', textAlign: 'center' as const, background: T.gold, color: T.bg,
    fontFamily: 'Cinzel, serif', fontSize: '0.72rem', fontWeight: 700,
    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
    padding: '11px 16px', borderRadius: 4, textDecoration: 'none', marginTop: '0.7rem',
  }

  if (reported) {
    return (
      <div className="data-box" style={{ padding: '1.5rem' }}>
        <div style={{ fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.2em', color: T.success, textTransform: 'uppercase', marginBottom: 8 }}>
          Awaiting Confirmation
        </div>
        <p style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, lineHeight: 1.7, margin: 0 }}>
          You&apos;ve told the Treasurer your {year} dues are on the way. He&apos;ll confirm once it
          lands, and you&apos;ll get a receipt by email. Your standing updates then — not before.
        </p>
      </div>
    )
  }

  return (
    <div className="data-box" style={{ padding: '1.5rem' }}>
      <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: T.ink, marginBottom: '0.4rem' }}>
        Pay the lodge directly
      </div>
      <p style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, lineHeight: 1.7, marginTop: 0, marginBottom: '1.25rem' }}>
        No processing fee — the lodge keeps the full ${amount}. Send it, then tell the Treasurer
        below so he knows to look for it.
      </p>

      {cashappUrl && (
        <div style={card}>
          <span style={label}>Cash App</span>
          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.05rem', color: T.ink }}>${cashapp}</div>
          <a href={cashappUrl} target="_blank" rel="noopener noreferrer" style={payLink}
             onClick={() => setMethod('cashapp')}>
            Send ${amount} with Cash App
          </a>
        </div>
      )}

      {venmoUrl && (
        <div style={card}>
          <span style={label}>Venmo</span>
          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '1.05rem', color: T.ink }}>@{venmo}</div>
          <a href={venmoUrl} target="_blank" rel="noopener noreferrer" style={payLink}
             onClick={() => setMethod('venmo')}>
            Send ${amount} with Venmo
          </a>
        </div>
      )}

      {zelle && (
        <div style={card}>
          <span style={label}>Zelle</span>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: T.inkFaint, margin: '0 0 0.7rem', lineHeight: 1.6 }}>
            Zelle is inside your own banking app. Send ${amount} to:
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: T.mono, fontSize: '0.88rem', color: T.ink, wordBreak: 'break-all' }}>{zelle}</span>
            <button
              type="button"
              onClick={async () => {
                try { await navigator.clipboard.writeText(zelle); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
                setMethod('zelle')
              }}
              style={{ fontFamily: T.mono, fontSize: '0.56rem', letterSpacing: '0.1em', background: 'transparent', border: `1px solid ${T.gold}`, color: T.gold, padding: '6px 12px', borderRadius: 3, cursor: 'pointer' }}
            >
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
          {zelleName && (
            <div style={{ marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: `1px solid ${T.border}` }}>
              <div style={{ fontFamily: T.mono, fontSize: '0.53rem', letterSpacing: '0.15em', color: T.inkFainter, textTransform: 'uppercase', marginBottom: 3 }}>
                Confirm this name before sending
              </div>
              <div style={{ fontFamily: 'Crimson Pro, serif', color: T.ink }}>{zelleName}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: `1px solid ${T.border}` }}>
        <label style={label} htmlFor="dues-method">Once you&apos;ve sent it</label>
        <select
          id="dues-method"
          value={method ?? ''}
          onChange={(e) => setMethod(e.target.value || null)}
          style={{ width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink, padding: '10px 13px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', borderRadius: 4, outline: 'none', marginBottom: '0.7rem', cursor: 'pointer' }}
        >
          <option value="">— How did you send it? —</option>
          {zelle && <option value="zelle">Zelle</option>}
          {cashapp && <option value="cashapp">Cash App</option>}
          {venmo && <option value="venmo">Venmo</option>}
          <option value="cash">Cash, in person</option>
          <option value="check">Check</option>
        </select>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Confirmation number or a note (optional)"
          style={{ width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink, padding: '10px 13px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', borderRadius: 4, outline: 'none', marginBottom: '0.9rem', boxSizing: 'border-box' }}
        />

        <button
          onClick={report}
          disabled={!method || busy}
          className="btn-gold"
          style={{ width: '100%', fontSize: '0.68rem', cursor: !method || busy ? 'not-allowed' : 'pointer', opacity: !method || busy ? 0.5 : 1 }}
        >
          {busy ? 'Sending…' : "I've Sent My Dues"}
        </button>

        <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.82rem', color: T.inkFainter, fontStyle: 'italic', margin: '0.7rem 0 0', lineHeight: 1.5 }}>
          This tells the Treasurer to look for your payment. Your standing updates once he confirms
          it arrived.
        </p>
      </div>
    </div>
  )
}
