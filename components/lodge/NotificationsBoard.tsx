'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { callApi, errorMessage } from '@/lib/clientFetch'
import { ROSTER_EVENTS, EVENT_META, notifiedByDefault, defaultReason, type RosterEvent } from '@/lib/notifications'
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
  prefs: Partial<Record<RosterEvent, boolean>>
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

  const effective = (m: Member, event: RosterEvent) => {
    const explicit = m.prefs[event]
    return explicit !== undefined ? explicit : notifiedByDefault(m.tenantRole, m.lodgeRole)
  }

  const toggle = async (m: Member, event: RosterEvent) => {
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

  // Anyone the defaults cover, plus anyone switched on by hand, plus
  // yourself — so you can always find your own row. Everyone else would
  // be twenty rows of "no" nobody needs to scroll past.
  const relevant = rows.filter(m =>
    m.userId === viewerId ||
    ROSTER_EVENTS.some(e => effective(m, e)) ||
    Object.keys(m.prefs).length > 0
  )
  const others = rows.filter(m => !relevant.includes(m))
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? rows : relevant

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
        {ROSTER_EVENTS.map(e => (
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
              {ROSTER_EVENTS.map(e => (
                <th key={e} style={th}>{EVENT_META[e].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map(m => {
              const reason = defaultReason(m.tenantRole, m.lodgeRole)
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

                  {ROSTER_EVENTS.map(e => {
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

      {others.length > 0 && (
        <button
          onClick={() => setShowAll(s => !s)}
          style={{
            marginTop: '0.9rem', background: 'transparent', border: `1px solid ${T.border}`,
            borderRadius: '4px', color: T.inkFaint, fontFamily: T.mono, fontSize: '9.5px',
            letterSpacing: '0.08em', textTransform: 'uppercase', padding: '7px 12px', cursor: 'pointer',
          }}
        >
          {showAll ? 'Show only those on the list' : `Show the other ${others.length} brethren`}
        </button>
      )}
    </div>
  )
}
