'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { QRCodeSVG } from 'qrcode.react'

/**
 * Meeting Mode — the live "lodge is open right now" view from the
 * reference image: a running timer, an agenda checklist with
 * checkmarks, a live attendance ring, and Close Lodge.
 *
 * The timer is deliberately NOT a separately-incrementing counter —
 * it's computed each tick as (now - opened_at), matching the design
 * note in migration 008. This means the timer is correct even if the
 * page is refreshed, or a different officer opens this same page on
 * another device mid-meeting; there's no client-side "clock state" to
 * get out of sync with the server's real opened_at timestamp.
 */
export default function MeetingModePage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [tenant, setTenant] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [activeEvent, setActiveEvent] = useState<any>(null)
  const [agendaItems, setAgendaItems] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [elapsed, setElapsed] = useState(0)
  const [loading, setLoading] = useState(true)
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadMeetingState = useCallback(async (eventId: string) => {
    const [{ data: ev }, { data: items }, { data: att }] = await Promise.all([
      supabase.from('lodge_events').select('*').eq('id', eventId).single(),
      supabase.from('meeting_agenda_items').select('*').eq('event_id', eventId).order('sort_order'),
      supabase.from('attendance').select('member_id, status').eq('event_id', eventId),
    ])
    setActiveEvent(ev)
    setAgendaItems(items ?? [])
    const attMap: Record<string, string> = {}
    for (const row of att ?? []) attMap[(row as any).member_id] = (row as any).status
    setAttendance(attMap)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: t } = await supabase.from('tenants').select('id, name, number').eq('slug', slug).single()
      if (!t) { setLoading(false); return }
      setTenant(t)
      console.log('TENANT', t)
      const [{ data: e }, { data: m }] = await Promise.all([
        supabase.from('lodge_events').select('id, title, event_date, opened_at, closed_at').eq('tenant_id', t.id).order('event_date', { ascending: false }).limit(20),
        supabase.from('tenant_members').select('user_id').eq('tenant_id', t.id).eq('is_active', true),
      ])
      setEvents(e ?? [])
      console.log('EVENTS LOADED', e)
      setMembers(m ?? [])

      // Auto-select whichever meeting is currently open, if any, rather
      // than defaulting to nothing and making the officer hunt for it —
      // a currently-live meeting is the thing this page exists to show.
      const currentlyOpen = (e ?? []).find((ev: any) => ev.opened_at && !ev.closed_at)
      if (currentlyOpen) {
        setSelectedEventId(currentlyOpen.id)
        await loadMeetingState(currentlyOpen.id)
      }
      setLoading(false)
    }
    init()
  }, [])

  useEffect(() => {
    if (selectedEventId) loadMeetingState(selectedEventId)
    else setActiveEvent(null)
  }, [selectedEventId])

  // Tick the live timer once a second, deriving elapsed time from the
  // real opened_at rather than incrementing a local counter — see the
  // component doc comment above for why that distinction matters.
  useEffect(() => {
    if (!activeEvent?.opened_at || activeEvent?.closed_at) { setElapsed(0); return }
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(activeEvent.opened_at).getTime()) / 1000))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeEvent?.opened_at, activeEvent?.closed_at])

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const openMeeting = async () => {
    if (!selectedEventId) return
    setBusy(true)
    setActionError('')
    const res = await fetch('/api/meeting/open', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, eventId: selectedEventId }),
    })
    const result = await res.json()
    if (!res.ok) setActionError(result.error)
    else await loadMeetingState(selectedEventId)
    setBusy(false)
  }

  const closeMeeting = async () => {
    if (!selectedEventId) return
    if (!window.confirm('Close the lodge? This ends the live meeting session.')) return
    setBusy(true)
    setActionError('')
    const res = await fetch('/api/meeting/close', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, eventId: selectedEventId }),
    })
    const result = await res.json()
    if (!res.ok) setActionError(result.error)
    else await loadMeetingState(selectedEventId)
    setBusy(false)
  }

  const toggleAgendaItem = async (item: any) => {
    // Optimistic update — the checklist should feel instant during a
    // live meeting, not wait on a round trip before the checkmark appears.
    setAgendaItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i))
    const res = await fetch('/api/meeting/agenda-item', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, itemId: item.id, completed: !item.completed }),
    })
    if (!res.ok) {
      // Revert on failure rather than leave the UI showing a state the
      // server never actually saved.
      setAgendaItems(prev => prev.map(i => i.id === item.id ? { ...i, completed: item.completed } : i))
    }
  }

  const isOpen = activeEvent?.opened_at && !activeEvent?.closed_at
  const presentCount = Object.values(attendance).filter(s => s === 'present').length
  const completedCount = agendaItems.filter(i => i.completed).length

  if (loading) return <div style={{ padding: '2rem', color: T.inkFaint, fontStyle: 'italic' }}>Loading...</div>

  return (
    <div style={{ background: T.bg, minHeight: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: T.display, fontSize: '1.5rem', color: T.ink, margin: 0 }}>Meeting Mode</h1>
          <p style={{ fontFamily: T.body, color: T.inkFaint, fontSize: '0.85rem', margin: '4px 0 0' }}>Run a live meeting — timer, roll call, and agenda in one place</p>
        </div>
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          disabled={isOpen}
          style={{ background: T.bgCard, border: `1px solid ${T.border}`, color: T.ink, padding: '9px 14px', borderRadius: '6px', fontFamily: T.body, fontSize: '0.85rem', outline: 'none', cursor: isOpen ? 'not-allowed' : 'pointer', minWidth: '220px', opacity: isOpen ? 0.6 : 1 }}
        >
          <option value="">— Select a meeting —</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>
              {new Date(e.event_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {e.title}{e.opened_at && !e.closed_at ? ' (OPEN)' : ''}
            </option>
          ))}
        </select>
      </div>

      {actionError && <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)', color: T.danger, padding: '10px 16px', borderRadius: '6px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>{actionError}</div>}

      {!selectedEventId && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '3rem', textAlign: 'center', color: T.inkFaint, fontStyle: 'italic' }}>
          Select a meeting above to open the lodge or view a session already in progress.
        </div>
      )}

      {selectedEventId && !isOpen && !activeEvent?.closed_at && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontFamily: T.display, fontSize: '1.1rem', color: T.ink, marginBottom: '0.5rem' }}>{activeEvent?.title}</div>
          <div style={{ fontFamily: T.body, color: T.inkFaint, fontSize: '0.85rem', marginBottom: '1.5rem' }}>This meeting has not been opened yet.</div>
          <button onClick={openMeeting} disabled={busy} style={{ background: T.gold, color: T.bg, border: 'none', padding: '12px 32px', borderRadius: '6px', fontFamily: T.display, fontSize: '0.9rem', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Opening…' : '⚒ Open Lodge'}
          </button>
        </div>
      )}

      {selectedEventId && activeEvent?.closed_at && (
        <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '3rem', textAlign: 'center' }}>
          <div style={{ fontFamily: T.display, fontSize: '1.1rem', color: T.ink, marginBottom: '0.5rem' }}>{activeEvent?.title}</div>
          <div style={{ color: T.success, fontSize: '0.85rem' }}>✓ This meeting was closed at {new Date(activeEvent.closed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
        </div>
      )}

      {isOpen && (
        <div className="lodgeos-meeting-layout" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem' }}>
          {/* Agenda checklist */}
          <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontFamily: T.display, fontSize: '1.1rem', color: T.ink }}>{activeEvent?.title}</div>
                <div style={{ fontFamily: T.mono, fontSize: '10px', color: T.success, letterSpacing: '0.08em', marginTop: '2px' }}>● IN PROGRESS</div>
              </div>
              <div style={{ fontFamily: T.mono, fontSize: '1.4rem', color: T.gold, letterSpacing: '0.05em' }}>{formatElapsed(elapsed)}</div>
            </div>
            {agendaItems.map((item, i) => (
              <div key={item.id} onClick={() => toggleAgendaItem(item)} style={{ padding: '0.85rem 1.25rem', borderBottom: i < agendaItems.length - 1 ? `1px solid ${T.border}` : 'none', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${item.completed ? T.success : T.inkFainter}`,
                  background: item.completed ? T.success : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.bg, fontSize: '12px',
                }}>{item.completed ? '✓' : ''}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.body, fontSize: '0.85rem', color: item.completed ? T.inkFaint : T.ink, textDecoration: item.completed ? 'line-through' : 'none' }}>{item.label}</div>
                  {item.notes && <div style={{ fontFamily: T.mono, fontSize: '10px', color: T.inkFainter, marginTop: '2px' }}>{item.notes}</div>}
                </div>
              </div>
            ))}
          </div>

          {/* Live attendance + close */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {activeEvent?.meeting_qr_token && (
              <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.15em', color: T.inkFaint, textTransform: 'uppercase', marginBottom: '10px' }}>Self Check-In</div>
                <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', display: 'inline-block', lineHeight: 0 }}>
                  <QRCodeSVG value={activeEvent.meeting_qr_token} size={110} level="M" />
                </div>
                <p style={{ color: T.inkFaint, fontSize: '0.72rem', marginTop: '10px', marginBottom: 0 }}>
                  Members can scan this to check themselves in — this code stops working the moment the lodge closes.
                </p>
              </div>
            )}
            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.15em', color: T.inkFaint, textTransform: 'uppercase', marginBottom: '1rem' }}>Attendance</div>
              <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto' }}>
                <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="52" fill="none" stroke={T.gold} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - (members.length ? presentCount / members.length : 0))}`}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontFamily: T.display, fontSize: '1.6rem', color: T.ink, lineHeight: 1 }}>{presentCount}</div>
                  <div style={{ fontFamily: T.mono, fontSize: '9px', color: T.inkFaint }}>of {members.length}</div>
                </div>
              </div>
              <a href={`/lodge/${slug}/attendance`} style={{ display: 'block', marginTop: '1rem', fontFamily: T.mono, fontSize: '10px', color: T.gold, textDecoration: 'none' }}>Record Attendance →</a>
            </div>

            <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: T.radius, padding: '1.25rem' }}>
              <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.15em', color: T.inkFaint, textTransform: 'uppercase', marginBottom: '8px' }}>Agenda Progress</div>
              <div style={{ fontFamily: T.display, fontSize: '1.3rem', color: T.ink }}>{completedCount} / {agendaItems.length}</div>
              <div style={{ marginTop: '8px', height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${agendaItems.length ? (completedCount / agendaItems.length) * 100 : 0}%`, background: T.success, borderRadius: '3px' }} />
              </div>
            </div>

            <button onClick={closeMeeting} disabled={busy} style={{ background: T.danger, color: '#fff', border: 'none', padding: '14px', borderRadius: '8px', fontFamily: T.display, fontSize: '0.9rem', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Closing…' : '⚒ Close Lodge'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
