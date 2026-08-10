'use client'

import { useState } from 'react'
import { T } from '@/lib/designTokens'

/**
 * Sends the dues reminder batch.
 *
 * REPLACES A BROKEN NATIVE FORM POST.
 *
 * The dues page previously did this:
 *
 *   <form action="/api/dues/remind" method="post">
 *     <input type="hidden" name="tenantId" ... />
 *
 * which was broken in two independent ways. A native form POST sends
 * application/x-www-form-urlencoded, but the route calls
 * `await request.json()` — so the body never parsed and the request
 * failed before it reached the auth check. And because a native form
 * submit is a real navigation, the route's JSON response would have
 * replaced the page with raw JSON in the browser window.
 *
 * The members page already called this endpoint correctly with fetch;
 * only the dues page had the broken copy.
 */
export function DuesReminderButton({ tenantId, dueCount }: { tenantId: string; dueCount: number }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')

  const send = async () => {
    setBusy(true)
    setError('')
    setResult('')
    try {
      const res = await fetch('/api/dues/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not send reminders.')
        return
      }
      setResult(
        `Sent to ${data.sent} ${data.sent === 1 ? 'brother' : 'brothers'}.` +
          (data.failed > 0 ? ` ${data.failed} could not be reached.` : '')
      )
    } catch (err: any) {
      setError(err?.message || 'Could not send reminders.')
    } finally {
      setBusy(false)
    }
  }

  if (dueCount === 0) {
    return (
      <span style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: T.success }}>
        All dues collected
      </span>
    )
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <button
        onClick={send}
        disabled={busy}
        className="btn-gold"
        style={{ fontSize: '0.68rem', cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}
      >
        {busy ? 'Sending…' : `Send Reminders (${dueCount})`}
      </button>

      {result && (
        <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: T.success, marginTop: 8 }}>
          ✓ {result}
        </div>
      )}
      {error && (
        <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: T.danger, marginTop: 8, maxWidth: 320 }}>
          {error}
        </div>
      )}
    </div>
  )
}
