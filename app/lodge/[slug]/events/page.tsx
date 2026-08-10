'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'

export default function LodgeEventsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [events, setEvents] = useState<any[]>([])
  const [rsvpCounts, setRsvpCounts] = useState<Record<string, { yes: number; no: number; maybe: number }>>({})
  const [tenant, setTenant] = useState<any>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
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

      {/* Cards, not a seven-column table.
          The table carried date, title, location, type, public flag, an
          RSVP tally and two action buttons in one row — which meant
          scrolling sideways past everything to reach anything on a
          phone. Everything beyond identity and headcount now lives on
          the event's own page, one tap away, where it has room to show
          WHO replied rather than three numbers. */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {events.map(ev => {
          const counts = rsvpCounts[ev.id]
          const past = new Date(ev.event_date + 'T12:00:00') < new Date(new Date().toDateString())
          return (
            <Link
              key={ev.id}
              href={`/lodge/${slug}/events/${ev.id}`}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem',
                flexWrap: 'wrap', textDecoration: 'none',
                background: '#141C2E', border: '1px solid rgba(201,168,76,0.12)',
                borderRadius: '10px', padding: '1.1rem 1.25rem',
                opacity: past ? 0.75 : 1,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.12em', color: '#C9A84C', marginBottom: 5 }}>
                  {format(new Date(ev.event_date + 'T12:00:00'), 'EEE, MMM d, yyyy').toUpperCase()}
                  {ev.event_time && ` · ${ev.event_time.slice(0, 5)}`}
                </div>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#F5F0E8', marginBottom: 4 }}>{ev.title}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className={`pill ${typeColor[ev.event_type] ?? 'pill-new'}`}>{ev.event_type.replace('_', ' ')}</span>
                  {ev.is_public && <span className="pill pill-active">Public</span>}
                  {ev.location && <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: '#B8B0A0' }}>{ev.location}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.3rem', color: counts?.yes ? '#5DBE85' : '#918879', lineHeight: 1 }}>
                    {counts?.yes ?? 0}
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0' }}>ATTENDING</div>
                </div>
                <span style={{ color: '#C9A84C', fontSize: '1.1rem' }} aria-hidden="true">›</span>
              </div>
            </Link>
          )
        })}
      </div>
      {events.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', background: '#141C2E', border: '1px solid rgba(201,168,76,0.12)', borderRadius: '10px' }}>
          No events yet. Create your first one above.
        </div>
      )}
    </div>
  )
}
