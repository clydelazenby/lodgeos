'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/designTokens'
import { notify } from '@/lib/toast'
import { callApi, errorMessage } from '@/lib/clientFetch'

/**
 * Deciding on a lodge that asked to use LodgeOS.
 *
 * WHY THE EMAIL DOES NOT DECIDE. The buttons in the alert carry an
 * INTENT — this page opens with that choice already made and waits for
 * one confirmation. An email gets forwarded, read over a shoulder, and
 * left open on an unlocked phone; a link that approved a lodge on its
 * own would hand that power to whoever came into possession of the
 * message. One extra tap is the whole price of that, and the route
 * behind it re-checks super-admin against the database regardless.
 *
 * DECLINE AND ASK BOTH WANT WORDS. A decline with no reason cannot be
 * answered, so the man simply asks again through another address; a
 * question with no question is not one. The box is required for both,
 * optional for an approval.
 */

type Request = {
  id: string
  lodge_name: string
  lodge_number: string | null
  jurisdiction: string | null
  contact_name: string
  contact_role: string | null
  contact_email: string
  contact_phone: string | null
  member_count: number | null
  message: string | null
  status: string
  created_at: string
}

type Action = 'approve' | 'decline' | 'question'

const INTENT: Record<Action, { title: string; verb: string; hint: string; needsNote: boolean }> = {
  approve: {
    title: 'Approve this lodge',
    verb: 'Approve and email him',
    hint: 'He is emailed a link to create his account and set the lodge up himself. Nothing is created for him — the lodge is named, and owned, by the man who signs up.',
    needsNote: false,
  },
  question: {
    title: 'Ask before deciding',
    verb: 'Send the question',
    hint: 'He is emailed your question and can reply directly. The request stays in the queue, because a question nobody answers is exactly the one that gets forgotten.',
    needsNote: true,
  },
  decline: {
    title: 'Decline this request',
    verb: 'Decline and email him',
    hint: 'He is emailed, with your reason if you give one. A decline that says nothing cannot be answered, so the man simply asks again through another address.',
    needsNote: true,
  },
}

export function RequestReview({
  request,
  duplicateOf,
  initialAction,
}: {
  request: Request
  /** A lodge of this name is already on the platform. */
  duplicateOf: { name: string; number: string | null; slug: string } | null
  /** Pre-selected by the button pressed in the email. */
  initialAction: Action | null
}) {
  const router = useRouter()
  const [action, setAction] = useState<Action | null>(initialAction)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Following a second button from the same email must not leave the
  // first one's half-typed reason attached to a different decision.
  useEffect(() => { setNote(''); setError('') }, [action])

  const settled = request.status === 'approved' || request.status === 'declined'
  const lodge = request.lodge_number
    ? `${request.lodge_name} #${request.lodge_number}`
    : request.lodge_name

  const submit = async () => {
    if (!action) return
    if (INTENT[action].needsNote && !note.trim()) {
      setError(action === 'question' ? 'Say what you need to know.' : 'Give him a reason.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await callApi<{ status: string; warning?: string | null }>(
        `/api/access-requests/platform/${request.id}`,
        { method: 'PATCH', body: { action, note } }
      )
      notify.saved(
        action === 'approve' ? 'Approved, and he has been emailed'
          : action === 'decline' ? 'Declined, and he has been emailed'
          : 'Your question has been sent'
      )
      if (result.warning) notify.error(result.warning)
      setAction(null)
      router.refresh()
    } catch (err) {
      setError(errorMessage(err, 'That could not be recorded.'))
    } finally {
      setBusy(false)
    }
  }

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', gap: '1rem', padding: '8px 0', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
      <div style={{ fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.14em', color: T.gold, textTransform: 'uppercase', width: 130, flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ fontFamily: T.body, fontSize: '1rem', color: T.ink, minWidth: 0, wordBreak: 'break-word', flex: 1 }}>
        {value}
      </div>
    </div>
  )

  return (
    <div>
      {/* THE WARNING COMES FIRST. It is the one thing that changes what
          the right decision is, and it arrived because a Senior Warden
          of an existing lodge could not sign in and filled in this form
          instead. */}
      {duplicateOf && (
        <div
          style={{
            borderLeft: `3px solid ${T.danger}`, background: T.dangerDim,
            padding: '1rem 1.1rem', borderRadius: '0 6px 6px 0', marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.14em', color: T.danger, textTransform: 'uppercase', marginBottom: 6 }}>
            This lodge may already be here
          </div>
          <p style={{ fontFamily: T.body, fontSize: '1rem', color: T.inkFaint, lineHeight: 1.6, margin: '0 0 0.75rem' }}>
            <strong style={{ color: T.ink }}>
              {duplicateOf.name}{duplicateOf.number ? ` #${duplicateOf.number}` : ''}
            </strong>{' '}
            is already on LodgeOS. Approving this would create a second lodge of the same name, with
            a separate roster and separate records. If this man is a brother of that lodge who could
            not sign in, what he needs is his invitation resending — not a lodge of his own.
          </p>
          <Link
            href={`/lodge/${duplicateOf.slug}/members`}
            style={{ fontFamily: T.mono, fontSize: '0.6rem', letterSpacing: '0.12em', color: T.gold, textTransform: 'uppercase', textDecoration: 'none' }}
          >
            Check that lodge&apos;s roster &rarr;
          </Link>
        </div>
      )}

      <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 8, padding: '1.25rem 1.4rem', marginBottom: '1.5rem' }}>
        {row('Lodge', lodge)}
        {request.jurisdiction && row('Jurisdiction', request.jurisdiction)}
        {row('Contact', request.contact_name)}
        {request.contact_role && row('Office', request.contact_role)}
        {row('Email', <a href={`mailto:${request.contact_email}`} style={{ color: T.gold }}>{request.contact_email}</a>)}
        {request.contact_phone && row('Phone', <a href={`tel:${request.contact_phone}`} style={{ color: T.gold }}>{request.contact_phone}</a>)}
        {request.member_count != null && row('Members', String(request.member_count))}
        {request.message && row('Message', request.message)}
        {row('Asked', new Date(request.created_at).toLocaleString())}
        {row('Status', <span style={{ textTransform: 'capitalize' }}>{request.status}</span>)}
      </div>

      {/* NOTHING HERE IS VERIFIED, and it is worth saying on the page
          where the decision is made rather than only on the form where
          it was typed. */}
      <p style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: '0.9rem', color: T.inkFainter, lineHeight: 1.6, marginBottom: '1.5rem' }}>
        Every word above was typed by an anonymous visitor. None of it has been checked — not the
        lodge, not the office he claims, not the roster size.
      </p>

      {settled && (
        <p style={{ fontFamily: T.body, fontSize: '1rem', color: T.inkFaint, marginBottom: '1.5rem' }}>
          This request was already {request.status}. Deciding again will email him again.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
        {(['approve', 'question', 'decline'] as Action[]).map(a => {
          const on = action === a
          const danger = a === 'decline'
          return (
            <button
              key={a}
              onClick={() => setAction(on ? null : a)}
              aria-pressed={on}
              style={{
                background: on ? (danger ? T.dangerDim : T.goldDim) : 'transparent',
                border: `1px solid ${on ? (danger ? 'rgba(231,76,60,0.5)' : T.goldBorder) : T.border}`,
                color: danger ? T.danger : on ? T.ink : T.inkFaint,
                fontFamily: T.mono, fontSize: '0.62rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', padding: '10px 16px', borderRadius: 4, cursor: 'pointer',
              }}
            >
              {a === 'approve' ? 'Approve' : a === 'question' ? 'Ask a question' : 'Decline'}
            </button>
          )
        })}
      </div>

      {action && (
        <div className="lodgeos-stage-in" style={{ background: T.bgCard, border: `1px solid ${T.borderStrong}`, borderRadius: 8, padding: '1.25rem 1.4rem' }}>
          <div style={{ fontFamily: T.display, fontSize: '1.05rem', color: T.ink, marginBottom: 6 }}>
            {INTENT[action].title}
          </div>
          <p style={{ fontFamily: T.body, fontSize: '0.95rem', color: T.inkFaint, lineHeight: 1.6, margin: '0 0 1rem' }}>
            {INTENT[action].hint}
          </p>

          <label
            htmlFor="request-note"
            style={{ fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.14em', color: T.gold, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}
          >
            {action === 'question' ? 'Your question' : action === 'decline' ? 'Your reason' : 'Anything to add (optional)'}
          </label>
          <textarea
            id="request-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder={
              action === 'question'
                ? 'Which Grand Lodge is this under, and who can vouch for the lodge?'
                : action === 'decline'
                  ? 'We are not taking on new lodges outside North Carolina at present.'
                  : 'We will be in touch to arrange the setup call.'
            }
            style={{
              width: '100%', background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4,
              color: T.ink, fontFamily: T.body,
              // 16px, or iOS zooms the page the moment this is focused —
              // and this is a page reached from a phone, from an email.
              fontSize: '16px', padding: '10px 12px', resize: 'vertical', boxSizing: 'border-box',
            }}
            maxLength={2000}
          />

          {error && (
            <p style={{ color: T.danger, fontFamily: T.body, fontSize: '0.9rem', margin: '0.6rem 0 0' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={submit} disabled={busy} className="btn-gold" style={{ opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Sending…' : INTENT[action].verb}
            </button>
            <button
              onClick={() => setAction(null)}
              disabled={busy}
              style={{
                background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 4,
                color: T.inkFaint, fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', padding: '9px 14px', cursor: busy ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
