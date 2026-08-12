'use client'
import { useState } from 'react'
import { T } from '@/lib/designTokens'
import { notify } from '@/lib/toast'
import { callApi, errorMessage } from '@/lib/clientFetch'

/**
 * The brothers who were invited and never arrived.
 *
 * WHY THIS IS ITS OWN SECTION. A man who has been sent an invitation
 * is on the roster from the moment it goes out — which is right, the
 * lodge admitted him — but he is not YET a man who can be reached
 * through this app, and until now nothing on the page said so. He sat
 * in the table between two brothers who sign in weekly, looking
 * identical to them.
 *
 * The invited-officers email already ends with "if you do not hear
 * again within a few days, the invitation is worth resending". This is
 * the page that sentence sends you to, and until now the only way to
 * act on it was to remove the man and invite him again — destroying his
 * roster row, his degree and his history to send an email.
 *
 * HOW LONG HE HAS BEEN WAITING IS THE WHOLE POINT. Two days is a man
 * who has not checked his email. Three weeks is a wrong address, and
 * the number is what tells them apart. So the wait is stated in days,
 * and past a fortnight it is stated in red.
 */

type Pending = {
  id: string
  name: string
  email: string | null
  invitedAt: string | null
  lastSentAt: string | null
}

const day = 24 * 60 * 60 * 1000

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return null
  return Math.max(0, Math.floor((Date.now() - then) / day))
}

/** "today", "yesterday", "6 days ago", "3 weeks ago". */
export function waited(iso: string | null): string {
  const d = daysSince(iso)
  if (d === null) return 'at some point'
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 14) return `${d} days ago`
  if (d < 60) return `${Math.round(d / 7)} weeks ago`
  return `${Math.round(d / 30)} months ago`
}

/** Past a fortnight with no sign-in, the address is the likely fault. */
export function overdue(iso: string | null): boolean {
  const d = daysSince(iso)
  return d !== null && d >= 14
}

export function PendingBrothers({
  tenantId,
  pending,
  onSent,
}: {
  tenantId: string
  pending: Pending[]
  /** Records the new send time on the row without a full reload. */
  onSent: (memberId: string, sentAt: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState(true)

  if (pending.length === 0) return null

  const resend = async (member: Pending) => {
    setBusy(member.id)
    try {
      const result = await callApi<{ sentAt: string; message: string; warning?: string | null }>(
        '/api/members/resend',
        { method: 'POST', body: { tenantId, memberId: member.id } }
      )
      onSent(member.id, result.sentAt)
      notify.saved(result.message ?? 'Invitation sent again')
      if (result.warning) notify.error(result.warning)
    } catch (err) {
      notify.error(errorMessage(err, 'That invitation could not be sent again.'))
    } finally {
      setBusy(null)
    }
  }

  const waiting = pending.filter(p => overdue(p.lastSentAt ?? p.invitedAt)).length

  return (
    <div className="data-box" style={{ marginBottom: '1.5rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="data-box-head"
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
          textAlign: 'left', font: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span aria-hidden="true" style={{ color: T.gold, fontFamily: T.mono, fontSize: '0.7rem' }}>
            {open ? '▾' : '▸'}
          </span>
          <span>Invited, not yet signed in</span>
          {waiting > 0 && (
            <span className="pill pill-new" style={{ color: T.danger, borderColor: 'rgba(231,76,60,0.35)' }}>
              {waiting} OVER A FORTNIGHT
            </span>
          )}
        </span>
        <span style={{ fontFamily: T.mono, fontSize: '0.58rem', color: T.inkFaint }}>{pending.length}</span>
      </button>

      {open && (
        <>
          <p
            style={{
              margin: 0, padding: '0.9rem 1.4rem 0', fontFamily: T.body, fontStyle: 'italic',
              fontSize: '0.9rem', color: T.inkFainter, lineHeight: 1.55,
            }}
          >
            These brothers are on the roster and have been emailed a sign-in link, but none of them
            has used it. Resending mints a fresh link — the old one may simply have expired.
          </p>

          {pending.map(p => {
            const last = p.lastSentAt ?? p.invitedAt
            const late = overdue(last)
            return (
              <div
                key={p.id}
                style={{
                  padding: '0.85rem 1.4rem', borderTop: `1px solid ${T.border}`,
                  display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontFamily: T.display, fontSize: '0.88rem', color: T.ink }}>{p.name}</div>
                  {/* The address is the thing to check when nothing
                      arrives, so it is shown rather than hidden behind
                      his profile — that is the entire diagnosis, and it
                      is one line long. */}
                  <div
                    style={{
                      fontFamily: T.body, fontSize: '0.85rem', color: T.inkFaint, marginTop: 2,
                      wordBreak: 'break-word',
                    }}
                  >
                    {p.email || <span style={{ color: T.danger }}>No email address on file</span>}
                  </div>
                  <div
                    style={{
                      fontFamily: T.mono, fontSize: '0.55rem', letterSpacing: '0.08em',
                      color: late ? T.danger : T.inkFainter, marginTop: 4,
                    }}
                  >
                    {p.lastSentAt
                      ? `SENT ${waited(p.lastSentAt).toUpperCase()}`
                      : `INVITED ${waited(p.invitedAt).toUpperCase()}`}
                  </div>
                </div>

                <button
                  onClick={() => resend(p)}
                  disabled={busy === p.id || !p.email}
                  title={p.email ? `Send ${p.name}'s invitation again` : 'There is no address to send to'}
                  /* Every button on this list says "Resend", so read
                     aloud they are indistinguishable — the name has to
                     be in the label, not only in the row above it. */
                  aria-label={p.email ? `Send ${p.name}'s invitation again` : `No address on file for ${p.name}`}
                  style={{
                    background: 'transparent', border: `1px solid ${T.goldBorder}`, borderRadius: 3,
                    color: T.gold, fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.1em',
                    textTransform: 'uppercase', padding: '7px 12px', whiteSpace: 'nowrap',
                    cursor: busy === p.id || !p.email ? 'not-allowed' : 'pointer',
                    opacity: busy === p.id || !p.email ? 0.5 : 1,
                  }}
                >
                  {busy === p.id ? 'Sending…' : 'Resend'}
                </button>
              </div>
            )
          })}

          {/* The one thing resending cannot fix, said once at the foot
              rather than on every row. His address is his sign-in and
              cannot be edited, so a wrong one needs a fresh invitation
              — and an officer who does not know that will press Resend
              until he gives up. */}
          <p
            style={{
              margin: 0, padding: '0.9rem 1.4rem', borderTop: `1px solid ${T.border}`,
              fontFamily: T.body, fontSize: '0.85rem', color: T.inkFainter, lineHeight: 1.55,
            }}
          >
            If an address is wrong, resending will not help — it is his sign-in and cannot be
            edited. Take him off the roster and invite him again at the right address.
          </p>
        </>
      )}
    </div>
  )
}
