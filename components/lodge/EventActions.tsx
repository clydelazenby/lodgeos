'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { T } from '@/lib/designTokens'
import { ConfirmDialog } from '@/components/lodge/ConfirmDialog'

/**
 * Actions on the event detail page: send invites, record attendance,
 * delete.
 *
 * On the old events table these were two bare text buttons crammed into
 * the last column, with REMOVE guarded only by window.confirm(). Since
 * deleting an event cascades to its RSVPs, agenda items and recorded
 * attendance (all `on delete cascade` in the schema), the confirmation
 * now says so.
 */
export function EventActions({
  tenantId,
  eventId,
  slug,
  eventTitle,
  isPast,
}: {
  tenantId: string
  eventId: string
  slug: string
  eventTitle: string
  isPast: boolean
}) {
  const router = useRouter()
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const sendInvites = async () => {
    setInviting(true)
    setInviteMsg('')
    try {
      const res = await fetch('/api/events/send-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, eventId }),
      })
      const data = await res.json()
      setInviteMsg(res.ok ? `Invites sent to ${data.sent} brothers.` : `Failed: ${data.error}`)
    } catch (err: any) {
      setInviteMsg(`Failed: ${err?.message ?? 'unknown error'}`)
    } finally {
      setInviting(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    setError('')
    try {
      const res = await fetch(`/api/events/${eventId}?tenantId=${encodeURIComponent(tenantId)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not delete this event.')
        return
      }
      router.push(`/lodge/${slug}/events`)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Could not delete this event.')
    } finally {
      setDeleting(false)
    }
  }

  const ghost = {
    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.1em',
    textTransform: 'uppercase' as const, background: 'transparent',
    border: `1px solid ${T.goldBorder}`, color: T.gold,
    padding: '9px 15px', borderRadius: 4, cursor: 'pointer', textDecoration: 'none',
    display: 'inline-block',
  }

  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={sendInvites} disabled={inviting} style={{ ...ghost, opacity: inviting ? 0.6 : 1 }}>
          {inviting ? 'Sending…' : 'Send Invites'}
        </button>

        <Link href={`/lodge/${slug}/attendance`} style={ghost}>
          {isPast ? 'Record Attendance' : 'Attendance'}
        </Link>

        <button
          onClick={() => { setError(''); setConfirmOpen(true) }}
          style={{ ...ghost, borderColor: 'rgba(231,76,60,0.3)', color: T.danger }}
        >
          Delete
        </button>
      </div>

      {inviteMsg && (
        <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: inviteMsg.startsWith('Failed') ? T.danger : T.success, marginTop: 8 }}>
          {inviteMsg}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this event?"
        confirmLabel="Delete Event"
        busy={deleting}
        error={error}
        onCancel={() => { if (!deleting) setConfirmOpen(false) }}
        onConfirm={remove}
        body={
          <>
            <p style={{ marginBottom: '0.9rem' }}>
              <strong style={{ color: T.ink }}>{eventTitle}</strong> will be removed.
            </p>
            <p style={{ margin: 0 }}>
              Its RSVPs, meeting agenda and any <strong style={{ color: T.ink }}>recorded attendance</strong> go
              with it — the schema cascades all three. If this meeting actually happened, its attendance
              is part of the lodge&apos;s record and deleting it will change past reports.
            </p>
          </>
        }
      />
    </div>
  )
}
