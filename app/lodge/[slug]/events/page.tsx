'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'

export default function LodgeEventsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [events, setEvents] = useState<any[]>([])
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, { yes: number; no: number; maybe: number }>>({})
  const [tenant, setTenant] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({})
  const [form, setForm] = useState({ title: '', event_date: '', event_time: '', location: '', description: '', dress_code: '', is_public: false, event_type: 'other' })
  const supabase = createClient()

  const loadRsvpCounts = async (eventIds: string[], tenantId: string) => {
    if (eventIds.length === 0) return
    const { data } = await supabase.from('event_rsvps').select('event_id, response').in('event_id', eventIds)
    const counts: Record<string, { yes: number; no: number; maybe: number }> = {}
    for (const id of eventIds) counts[id] = { yes: 0, no: 0, maybe: 0 }
    for (const r of data ?? []) {
      if (counts[r.event_id]) counts[r.event_id][r.response as 'yes' | 'no' | 'maybe']++
    }
    setRsvpCounts(counts)
  }

  useEffect(() => {
    const load = async () => {
      const { data: t } = await supabase.from('tenants').select('id, name, address, city, state').eq('slug', slug).single()
      if (t) {
        setTenant(t)
        setForm(p => ({ ...p, location: t.address ? `${t.address}, ${t.city}, ${t.state}` : '' }))
        const { data: e } = await supabase.from('lodge_events').select('*').eq('tenant_id', t.id).order('event_date')
        setEvents(e ?? [])
        loadRsvpCounts((e ?? []).map(ev => ev.id), t.id)
      }
    }
    load()
  }, [])

  const sendInvites = async (eventId: string) => {
    setInvitingId(eventId)
    setInviteMsg(m => ({ ...m, [eventId]: '' }))
    const res = await fetch('/api/events/send-invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, eventId }),
    })
    const result = await res.json()
    setInviteMsg(m => ({
      ...m,
      [eventId]: res.ok && result.success
        ? `Sent to ${result.sent} of ${result.total} brothers.`
        : `Failed to send: ${result.error || 'unknown error'}`,
    }))
    setInvitingId(null)
    loadRsvpCounts(events.map(ev => ev.id), tenant.id)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: newEvent } = await supabase.from('lodge_events').insert({ ...form, tenant_id: tenant.id, created_by: user?.id }).select().single()
    if (newEvent) setEvents(prev => [...prev, newEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)))
    setShowForm(false)
    setForm(p => ({ ...p, title: '', event_date: '', event_time: '', description: '', dress_code: '' }))
    setSaving(false)
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('Remove this event?')) return
    await supabase.from('lodge_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const inputStyle = { width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', outline: 'none', borderRadius: '4px' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '5px', display: 'block' }
  const typeColor: Record<string, string> = { degree: 'pill-fc', grand_lodge: 'pill-mm', stated_communication: 'pill-ea', social: 'pill-active', other: 'pill-new' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Events</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Lodge calendar and scheduling</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-gold" style={{ fontSize: '0.68rem' }}>{showForm ? 'Cancel' : '+ New Event'}</button>
      </div>

      {showForm && (
        <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.15)', padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#C9A84C', marginBottom: '1.5rem' }}>New Event</div>
          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Event Title *</label><input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Stated Communication — April" style={inputStyle} required /></div>
            <div><label style={labelStyle}>Date *</label><input type="date" value={form.event_date} onChange={e => setForm(p => ({ ...p, event_date: e.target.value }))} style={inputStyle} required /></div>
            <div><label style={labelStyle}>Time</label><input type="time" value={form.event_time} onChange={e => setForm(p => ({ ...p, event_time: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Type</label>
              <select value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="degree">Degree</option>
                <option value="stated_communication">Stated Communication</option>
                <option value="grand_lodge">Grand Lodge</option>
                <option value="social">Social</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div><label style={labelStyle}>Public on website?</label>
              <select value={form.is_public ? 'yes' : 'no'} onChange={e => setForm(p => ({ ...p, is_public: e.target.value === 'yes' }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="no">No — Members only</option>
                <option value="yes">Yes — Show on public site</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Location</label><input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Dress Code</label><input value={form.dress_code} onChange={e => setForm(p => ({ ...p, dress_code: e.target.value }))} placeholder="Formal / Black suit..." style={inputStyle} /></div>
            <div><label style={labelStyle}>Description</label><input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} /></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" disabled={saving} className="btn-gold" style={{ fontSize: '0.68rem', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save Event'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="data-box">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Date', 'Event', 'Location', 'Type', 'Public', 'Attending', ''].map(h => <th key={h} className="dash-th">{h}</th>)}</tr></thead>
          <tbody>
            {events.map((ev, i) => (
              <tr key={ev.id}>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: '#B8B0A0', whiteSpace: 'nowrap' }}>
                  {format(new Date(ev.event_date + 'T12:00:00'), 'MMM d, yyyy')}
                  {ev.event_time && ` · ${ev.event_time}`}
                </td>
                <td className="dash-td">{ev.title}</td>
                <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>{ev.location || '—'}</td>
                <td className="dash-td"><span className={`pill ${typeColor[ev.event_type] ?? 'pill-new'}`}>{ev.event_type.replace('_', ' ')}</span></td>
                <td className="dash-td"><span className={`pill ${ev.is_public ? 'pill-active' : 'pill-new'}`}>{ev.is_public ? 'Yes' : 'No'}</span></td>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                  {rsvpCounts[ev.id] ? (
                    <span>
                      <span style={{ color: '#5DBE85' }}>{rsvpCounts[ev.id].yes} yes</span>
                      {' · '}<span style={{ color: '#C9A84C' }}>{rsvpCounts[ev.id].maybe} maybe</span>
                      {' · '}<span style={{ color: '#E74C3C' }}>{rsvpCounts[ev.id].no} no</span>
                    </span>
                  ) : <span style={{ color: '#B8B0A0' }}>—</span>}
                </td>
                <td className="dash-td">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => sendInvites(ev.id)} disabled={invitingId === ev.id} style={{ background: 'none', border: 'none', cursor: invitingId === ev.id ? 'not-allowed' : 'pointer', color: '#C9A84C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.08em', opacity: invitingId === ev.id ? 0.5 : 1 }}>
                        {invitingId === ev.id ? 'SENDING…' : 'SEND INVITES'}
                      </button>
                      <button onClick={() => deleteEvent(ev.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E74C3C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.08em' }}>REMOVE</button>
                    </div>
                    {inviteMsg[ev.id] && <div style={{ color: '#B8B0A0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem' }}>{inviteMsg[ev.id]}</div>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No events yet. Create your first one above.</div>}
      </div>
    </div>
  )
}
