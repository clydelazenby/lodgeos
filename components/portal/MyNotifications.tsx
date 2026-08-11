'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { callApi, errorMessage } from '@/lib/clientFetch'
import {
  NOTIFICATION_EVENTS, EVENT_META, EVENT_AUDIENCE, notifiedByDefault,
  type NotificationEvent,
} from '@/lib/notifications'

/**
 * What this brother is emailed about, switched by him.
 *
 * IT HAS TO BE HERE, not only on the lodge-side Notifications page. The
 * gallery notice goes to every brother including the plain member tier
 * — and that tier is redirected out of the lodge side entirely, so a
 * page there would offer him a switch he could never reach. An email he
 * cannot stop is one he marks as spam, which costs the lodge the
 * channel it will need for something that matters.
 *
 * HE ONLY SEES WHAT HE ACTUALLY GETS. Listing the three roster notices
 * to a brother who does not receive them would invite him to switch on
 * something the officers' rules do not give him.
 */
export function MyNotifications({
  tenantId, memberId, tenantRole, lodgeRole, prefs: initial,
}: {
  tenantId: string
  memberId: string
  tenantRole: string
  lodgeRole: string | null
  prefs: Partial<Record<NotificationEvent, boolean>>
}) {
  const router = useRouter()
  const [prefs, setPrefs] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const effective = (event: NotificationEvent) => {
    const explicit = prefs[event]
    return explicit !== undefined ? explicit : notifiedByDefault(event, tenantRole, lodgeRole)
  }

  // Everything he is on the list for, plus anything he has switched on
  // by hand. Not the notices he would never receive anyway.
  const mine = NOTIFICATION_EVENTS.filter(
    e => EVENT_AUDIENCE[e] === 'everyone'
      || notifiedByDefault(e, tenantRole, lodgeRole)
      || prefs[e] !== undefined
  )

  const toggle = async (event: NotificationEvent) => {
    const next = !effective(event)
    const before = prefs
    setPrefs(p => ({ ...p, [event]: next }))
    setBusy(event)
    setError('')
    try {
      await callApi('/api/notifications', {
        method: 'PATCH',
        body: { tenantId, memberId, event, enabled: next },
      })
      router.refresh()
    } catch (e) {
      setPrefs(before)
      setError(errorMessage(e, 'That could not be saved.'))
    } finally {
      setBusy(null)
    }
  }

  if (!mine.length) return null

  return (
    <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.12)', borderRadius: '10px', padding: '1.25rem' }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '0.14em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '6px' }}>
        Emails from the lodge
      </div>
      <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: '#B8B0A0', marginTop: 0, marginBottom: '1rem' }}>
        Switch off anything you would rather not receive. This does not affect notices the
        Secretary sends to the whole lodge.
      </p>

      {error && (
        <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', color: '#EC5B4B', padding: '9px 12px', borderRadius: '5px', marginBottom: '0.9rem', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '0.7rem' }}>
        {mine.map(event => {
          const on = effective(event)
          return (
            <label
              key={event}
              style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer', opacity: busy === event ? 0.55 : 1 }}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={busy === event}
                onChange={() => toggle(event)}
                style={{ accentColor: '#C9A84C', marginTop: 3 }}
              />
              <span>
                <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#F5F0E8' }}>
                  {EVENT_META[event].label}
                </span>
                <span style={{ display: 'block', fontFamily: 'Crimson Pro, serif', fontSize: '0.86rem', color: '#918879' }}>
                  {EVENT_META[event].blurb}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
