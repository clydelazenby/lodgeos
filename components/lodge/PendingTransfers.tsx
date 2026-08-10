'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { T } from '@/lib/designTokens'
import { notify } from '@/lib/toast'

/**
 * The Treasurer's queue: transfers brothers say they have sent, waiting
 * to be checked against the bank.
 *
 * This exists because Zelle has no webhook. A card payment reconciles
 * itself; a transfer needs an officer to look at the Truist account and
 * say yes. Confirming here does exactly what Stripe's webhook does for a
 * card — marks the brother paid, stamps the date, clears his reminder
 * threshold and sends the receipt.
 *
 * Rejecting is offered alongside, because "he said he sent it and it
 * never came" is a real outcome that otherwise leaves a pending row
 * sitting in the ledger forever.
 */

const METHOD_LABEL: Record<string, string> = {
  zelle: 'Zelle', cashapp: 'Cash App', venmo: 'Venmo',
  cash: 'Cash', check: 'Check', other: 'Other',
}

type Pending = {
  id: string
  member_id: string
  amount: number
  dues_year: number | null
  payment_method: string | null
  reported_at: string | null
  reference_note: string | null
  profiles?: { first_name: string | null; last_name: string | null } | null
}

export function PendingTransfers({ tenantId, pending }: { tenantId: string; pending: Pending[] }) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  if (!pending.length) return null

  const act = async (paymentId: string, action: 'confirm' | 'reject') => {
    setBusyId(paymentId)
    try {
      const res = await fetch('/api/dues/transfer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, paymentId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        notify.error(data.error || 'Could not update that payment.')
        return
      }
      notify.saved(data.message)
      router.refresh()
    } catch (err: any) {
      notify.error(err?.message || 'Could not update that payment.')
    } finally {
      setBusyId(null)
    }
  }

  const btn = {
    fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.1em',
    textTransform: 'uppercase' as const, padding: '7px 13px',
    borderRadius: 3, cursor: 'pointer',
  }

  return (
    <div className="data-box" style={{ borderColor: 'rgba(201,168,76,0.35)' }}>
      <div className="data-box-head">
        <span>
          Awaiting Your Confirmation
          <span style={{ fontFamily: T.mono, fontSize: '0.62rem', color: T.gold, marginLeft: 10 }}>
            {pending.length} {pending.length === 1 ? 'payment' : 'payments'}
          </span>
        </span>
      </div>

      <p style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, lineHeight: 1.7, padding: '1rem 1.4rem 0', margin: 0 }}>
        These brothers say they have sent their dues. Check the lodge account, then confirm —
        confirming marks them paid and emails a receipt.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{['Brother', 'Method', 'Amount', 'Reported', ''].map((h, i) => <th key={h || `p${i}`} className="dash-th">{h}</th>)}</tr>
        </thead>
        <tbody>
          {pending.map((p) => {
            const name = `${p.profiles?.first_name ?? ''} ${p.profiles?.last_name ?? ''}`.trim() || 'Unknown'
            return (
              <tr key={p.id}>
                <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>
                  Bro. {name}
                  {p.reference_note && (
                    <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.82rem', color: T.inkFaint, marginTop: 2 }}>
                      “{p.reference_note}”
                    </div>
                  )}
                </td>
                <td className="dash-td"><span className="pill pill-ea">{METHOD_LABEL[p.payment_method ?? ''] ?? p.payment_method}</span></td>
                <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                  ${Number(p.amount).toLocaleString()}
                  {p.dues_year && <span style={{ fontFamily: T.mono, fontSize: '0.6rem', color: T.inkFaint }}> · {p.dues_year}</span>}
                </td>
                <td className="dash-td" style={{ fontFamily: T.mono, fontSize: '0.66rem', color: T.inkFaint, whiteSpace: 'nowrap' }}>
                  {p.reported_at ? format(new Date(p.reported_at), 'MMM d') : '—'}
                </td>
                <td className="dash-td" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => act(p.id, 'confirm')}
                      disabled={busyId === p.id}
                      style={{ ...btn, background: T.gold, border: 'none', color: T.bg }}
                    >
                      {busyId === p.id ? '…' : 'Received'}
                    </button>
                    <button
                      onClick={() => act(p.id, 'reject')}
                      disabled={busyId === p.id}
                      style={{ ...btn, background: 'transparent', border: `1px solid ${T.border}`, color: T.inkFaint }}
                    >
                      Not Received
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
