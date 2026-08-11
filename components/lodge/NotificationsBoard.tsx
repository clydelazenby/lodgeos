'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { callApi, errorMessage } from '@/lib/clientFetch'
import { NOTIFICATION_EVENTS, EVENT_META, notifiedByDefault, defaultReason, type NotificationEvent } from '@/lib/notifications'
import { roleLabel } from '@/lib/auth/permissions'

/**
 * Who gets an email when the roster changes.
 *
 * SHOWS THE WHOLE LIST, not just a switch for yourself. The question an
 * officer actually has is "is anybody being told about this?" — and a
 * page that answers only "am I" cannot answer it. It is also how you
 * find out that the one man who was watching has quietly turned it off.
 *
 * EVERY ROW SAYS WHY. "Administrative access" and "Senior Warden" are
 * different reasons to be on the list and they end differently — one
 * follows the man, the other follows the chair through December. A
 * check mark alone tells you neither.
 */

type Member = {
  userId: string
  name: string
  email: string | null
  tenantRole: string
  lodgeRole: string | null
  prefs: Partial<Record<NotificationEvent, boolean>>
}

export function NotificationsBoard({
  tenantId, members, viewerId, canEditOthers,
}: {
  tenantId: string
  members: Member[]
  viewerId: string
  /** Admin, secretary or grand master. Everyone may edit his own. */
  canEditOthers: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState(members)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const effective = (m: Member, event: NotificationEvent) => {
    const explicit = m.prefs[event]
    return explicit !== undefined ? explicit : notifiedByDefault(event, m.tenantRole, m.lodgeRole)
  }

  const toggle = async (m: Member, event: NotificationEvent) => {
    const editable = canEditOthers || m.userId === viewerId
    if (!editable) return
    if (!m.email) return

    const next = !effective(m, event)
    const key = `${m.userId}:${event}`
    const before = rows

    setRows(rs => rs.map(r => (r.userId === m.userId ? { ...r, prefs: { ...r.prefs, [event]: next } } : r)))
    setBusy(key)
    setError('')
    try {
      await callApi('/api/notifications', {
        method: 'PATCH',
        body: { tenantId, memberId: m.userId, event, enabled: next },
      })
      router.refresh()
    } catch (e) {
      setRows(before)
      setError(errorMessage(e, 'That could not be saved.'))
    } finally {
      setBusy(null)
    }
  }

  /**
   * EVERYONE, now that one of these reaches every brother.
   *
   * This used to hide the men no notice touched. With the gallery
   * notice going to the whole lodge there is no such man, and a filter
   * that hides nobody is a control that only raises the question of
   * what it is hiding.
   */
  const shown = rows

  const th: React.CSSProperties = {
    fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.08em', color: T.inkFainter,
    textTransform: 'uppercase', padding: '10px 8px', textAlign: 'center',
    borderBottom: `1px solid ${T.border}`, width: 130, verticalAlign: 'bottom',
  }

  return (
    <div style={{ minWidth: 0 }}>
      {error && (
        <div style={{ background: T.dangerDim, border: '1px solid rgba(231,76,60,0.3)', color: T.danger, padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem', fontFamily: T.body, fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {!canEditOthers && (
        <div style={{ background: T.infoDim, border: '1px solid rgba(123,184,212,0.3)', color: T.info, padding: '10px 14px', borderRadius: '6px', marginBottom: '1rem', fontFamily: T.body, fontSize: '0.9rem' }}>
          You can switch your own notices on and off. Changing anyone else&rsquo;s is the
          Secretary&rsquo;s office.
        </div>
      )}

      {/* What each notice is for, before the grid of switches. */}
      <div style={{ display: 'grid', gap: '0.6rem', marginBottom: '1.25rem' }}>
        {NOTIFICATION_EVENTS.map(e => (
          <div key={e} style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '0.8rem 1rem' }}>
            <div style={{ fontFamily: T.display, fontSize: '0.9rem', color: T.ink }}>{EVENT_META[e].label}</div>
            <div style={{ fontFamily: T.body, fontSize: '0.86rem', color: T.inkFaint, marginTop: 2 }}>
              {EVENT_META[e].blurb}
            </div>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', border: `1px solid ${T.border}`, borderRadius: T.radius, background: T.bgCard }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left', width: 240, position: 'sticky', left: 0, background: T.bgCard, zIndex: 1 }}>
                Brother
              </th>
              {NOTIFICATION_EVENTS.map(e => (
                <th key={e} style={th}>{EVENT_META[e].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(m => {
              // The ROSTER rule, for the row's label. It is not the
              // whole story now that one event reaches every brother —
              // so the label says why he is on the officers' list, and
              // each cell carries its own answer.
              const reason = defaultReason('member.invited', m.tenantRole, m.lodgeRole)
              const editable = canEditOthers || m.userId === viewerId
              return (
                <tr key={m.userId}>
                  <td style={{ padding: '10px', borderBottom: `1px solid ${T.border}`, position: 'sticky', left: 0, background: T.bgCard, zIndex: 1 }}>
                    <div style={{ fontFamily: T.body, fontSize: '0.88rem', color: T.ink }}>
                      {m.name}{m.userId === viewerId ? ' (you)' : ''}
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: '9px', letterSpacing: '0.06em', color: reason ? T.gold : T.inkFainter, marginTop: 2 }}>
                      {(reason ?? roleLabel(m.tenantRole as any)).toUpperCase()}
                    </div>
                    {/* An officer with no address cannot be told anything,
                        and a switch that silently does nothing is worse
                        than one that explains itself. */}
                    {!m.email && (
                      <div style={{ fontFamily: T.body, fontSize: '0.8rem', color: T.danger, marginTop: 2 }}>
                        No email address on file — he cannot be notified.
                      </div>
                    )}
                  </td>

                  {NOTIFICATION_EVENTS.map(e => {
                    const on = effective(m, e)
                    const explicit = m.prefs[e] !== undefined
                    const key = `${m.userId}:${e}`
                    return (
                      <td key={e} style={{ borderBottom: `1px solid ${T.border}`, textAlign: 'center', padding: 0 }}>
                        <button
                          onClick={() => toggle(m, e)}
                          disabled={!editable || !m.email || busy === key}
                          aria-label={`${EVENT_META[e].label} for ${m.name}: ${on ? 'on' : 'off'}`}
                          aria-pressed={on}
                          style={{
                            width: '100%', height: 48, background: 'transparent', border: 'none',
                            cursor: editable && m.email ? 'pointer' : 'default',
                            opacity: busy === key ? 0.4 : m.email ? 1 : 0.3,
                            color: on ? T.success : T.inkFainter,
                            fontFamily: T.mono, fontSize: '15px',
                          }}
                        >
                          {on ? '✓' : '—'}
                          {/* A dot marks a deliberate choice, so a
                              default and a decision are not confused. */}
                          {explicit && (
                            <span style={{ display: 'block', fontSize: '7px', letterSpacing: '0.1em', color: T.gold }}>SET</span>
                          )}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
