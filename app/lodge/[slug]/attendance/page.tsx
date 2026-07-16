'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
<<<<<<< HEAD
import { QrCheckinScanner } from '@/components/lodge/QrCheckinScanner'
=======
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d

type Status = 'present' | 'absent' | 'excused'

const STATUS_STYLE: Record<Status, { bg: string; border: string; text: string }> = {
  present: { bg: 'rgba(93,190,133,0.12)', border: '#5DBE85', text: '#5DBE85' },
  excused: { bg: 'rgba(201,168,76,0.12)', border: '#C9A84C', text: '#C9A84C' },
  absent: { bg: 'transparent', border: 'rgba(184,176,160,0.3)', text: '#B8B0A0' },
}

export default function LodgeAttendancePage() {
  const params = useParams()
  const slug = params.slug as string
<<<<<<< HEAD
  const supabase = createClient()
=======
  const supabase = await createClient()
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d

  const [tenant, setTenant] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [marks, setMarks] = useState<Record<string, Status>>({})
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: t } = await supabase.from('tenants').select('id, name').eq('slug', slug).single()
      if (!t) return
      setTenant(t)

      const { data: e } = await supabase.from('lodge_events').select('id, title, event_date').eq('tenant_id', t.id).order('event_date', { ascending: false })
      setEvents(e ?? [])

      const { data: m } = await supabase.from('tenant_members').select('user_id, profiles(first_name, last_name)').eq('tenant_id', t.id).eq('is_active', true)
      setMembers(m ?? [])
    }
    load()
  }, [])

  useEffect(() => {
    const loadExisting = async () => {
      if (!selectedEventId) { setMarks({}); return }
      const { data } = await supabase.from('attendance').select('member_id, status').eq('event_id', selectedEventId)
      const initial: Record<string, Status> = {}
      for (const row of data ?? []) initial[row.member_id] = row.status as Status
      setMarks(initial)
      setSaveMsg('')
    }
    loadExisting()
  }, [selectedEventId])

  const setMark = (memberId: string, status: Status) => setMarks(prev => ({ ...prev, [memberId]: status }))

  const markAllPresent = () => {
    const next: Record<string, Status> = {}
    for (const m of members) next[m.user_id] = 'present'
    setMarks(next)
  }

  const save = async () => {
    setSaving(true)
    setSaveMsg('')
    const records = Object.entries(marks).map(([memberId, status]) => ({ memberId, status }))
    const res = await fetch('/api/attendance/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, eventId: selectedEventId, records }),
    })
    const result = await res.json()
    setSaveMsg(res.ok ? `Saved attendance for ${result.recorded} brothers.` : `Failed: ${result.error}`)
    setSaving(false)
  }

  const presentCount = Object.values(marks).filter(s => s === 'present').length
  const selectedEvent = events.find(e => e.id === selectedEventId)

  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '5px', display: 'block' }
  const selectStyle = { width: '100%', maxWidth: '420px', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', outline: 'none', borderRadius: '4px', cursor: 'pointer' }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Attendance</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Record who was present at a stated or special communication</p>
      </div>

<<<<<<< HEAD
      {tenant && <QrCheckinScanner tenantId={tenant.id} />}

=======
>>>>>>> cf585ed7f3e904382177b4c602f41a0ed7d0ca4d
      <div style={{ marginBottom: '2rem' }}>
        <label style={labelStyle}>Select Event</label>
        <select value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} style={selectStyle}>
          <option value="">— Choose an event —</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{format(new Date(e.event_date + 'T12:00:00'), 'MMM d, yyyy')} — {e.title}</option>
          ))}
        </select>
        {events.length === 0 && (
          <p style={{ color: '#B8B0A0', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '8px' }}>
            No events yet — create one on the Events page first.
          </p>
        )}
      </div>

      {selectedEventId && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', color: '#B8B0A0' }}>
              {presentCount} of {members.length} marked present
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={markAllPresent} className="btn-gold" style={{ fontSize: '0.62rem', padding: '8px 14px' }}>Mark All Present</button>
              <button onClick={save} disabled={saving} className="btn-gold" style={{ fontSize: '0.62rem', padding: '8px 14px', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : 'Save Attendance'}
              </button>
            </div>
          </div>
          {saveMsg && <div style={{ color: saveMsg.startsWith('Failed') ? '#E74C3C' : '#5DBE85', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', marginBottom: '1rem' }}>{saveMsg}</div>}

          <div className="data-box">
            <div className="data-box-head">{selectedEvent?.title}</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['Brother', 'Status'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr></thead>
              <tbody>
                {members.map(m => {
                  const status = marks[m.user_id] ?? 'absent'
                  return (
                    <tr key={m.user_id}>
                      <td className="dash-td" style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem' }}>
                        Bro. {m.profiles?.first_name} {m.profiles?.last_name}
                      </td>
                      <td className="dash-td">
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {(['present', 'excused', 'absent'] as Status[]).map(s => (
                            <button
                              key={s}
                              onClick={() => setMark(m.user_id, s)}
                              style={{
                                background: status === s ? STATUS_STYLE[s].bg : 'transparent',
                                border: `1px solid ${status === s ? STATUS_STYLE[s].border : 'rgba(184,176,160,0.2)'}`,
                                color: status === s ? STATUS_STYLE[s].text : '#6B6355',
                                padding: '4px 10px', borderRadius: '3px', cursor: 'pointer',
                                fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.05em', textTransform: 'capitalize',
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {members.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No active members yet.</div>}
          </div>
        </>
      )}
    </div>
  )
}
