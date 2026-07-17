'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

const CARE_TYPE_LABEL: Record<string, string> = { sickness: 'Sickness', distress: 'Distress', widow: 'Widow', other: 'Other' }
const CARE_TYPE_COLOR: Record<string, string> = { sickness: '#E74C3C', distress: '#C9A84C', widow: '#7BB8D4', other: '#B8B0A0' }

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

export default function CareRegistryPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [tenant, setTenant] = useState<any>(null)
  const [entries, setEntries] = useState<any[]>([]) 
  const [members, setMembers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [form, setForm] = useState({ personName: '', relationship: '', careType: 'sickness', memberId: '', summary: '', contactPhone: '', assignedTo: '', checkInIntervalDays: 14 })

  const load = async (tenantId: string) => {
    const { data } = await supabase.from('care_entries').select('*, assignee:profiles!care_entries_assigned_to_fkey(first_name, last_name)').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setEntries(data ?? [])
  }

  useEffect(() => {
    const init = async () => {
      const { data: t } = await supabase.from('tenants').select('id, name').eq('slug', slug).single()
      if (!t) return
      setTenant(t)
      load(t.id)
      const { data: m } = await supabase.from('tenant_members').select('user_id, profiles(first_name, last_name)').eq('tenant_id', t.id).eq('is_active', true)
      setMembers(m ?? [])
    }
    init()
  }, [])

  const submitEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/care/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, action: 'create', ...form, memberId: form.memberId || null, assignedTo: form.assignedTo || null }),
    })
    if (res.ok) {
      setForm({ personName: '', relationship: '', careType: 'sickness', memberId: '', summary: '', contactPhone: '', assignedTo: '', checkInIntervalDays: 14 })
      setShowForm(false)
      load(tenant.id)
    }
    setSaving(false)
  }

  const logCheckIn = async (entryId: string) => {
    const note = window.prompt('Optional note about this check-in (leave blank to skip):') || ''
    const res = await fetch('/api/care/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, action: 'check-in', entryId, note }),
    })
    if (res.ok) load(tenant.id)
  }

  const setStatus = async (entryId: string, status: string) => {
    const res = await fetch('/api/care/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: tenant.id, action: 'update', entryId, status }),
    })
    if (res.ok) load(tenant.id)
  }

  const visible = entries.filter(e => filter === 'all' || e.status !== 'resolved')
  const inputStyle = { width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '9px 12px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', outline: 'none', borderRadius: '4px' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.15em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '4px', display: 'block' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Sickness, Distress &amp; Widows</h1>
          <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Brothers who need checking on, and widows the lodge is caring for</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="btn-gold" style={{ fontSize: '0.68rem' }}>{showForm ? 'Cancel' : '+ New Entry'}</button>
      </div>

      {showForm && (
        <form onSubmit={submitEntry} style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.15)', padding: '1.5rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div><label style={labelStyle}>Name</label><input required value={form.personName} onChange={e => setForm(p => ({ ...p, personName: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Relationship (if not a member)</label><input value={form.relationship} onChange={e => setForm(p => ({ ...p, relationship: e.target.value }))} placeholder="e.g. Widow of Bro. Ellis" style={inputStyle} /></div>
          <div><label style={labelStyle}>Type</label>
            <select value={form.careType} onChange={e => setForm(p => ({ ...p, careType: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="sickness">Sickness</option>
              <option value="distress">Distress</option>
              <option value="widow">Widow</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div><label style={labelStyle}>Link to Member (optional)</label>
            <select value={form.memberId} onChange={e => setForm(p => ({ ...p, memberId: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">— Not a current member —</option>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profiles?.first_name} {m.profiles?.last_name}</option>)}
            </select>
          </div>
          <div><label style={labelStyle}>Contact Phone</label><input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} style={inputStyle} /></div>
          <div><label style={labelStyle}>Assign To (typically Chaplain)</label>
            <select value={form.assignedTo} onChange={e => setForm(p => ({ ...p, assignedTo: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">— Unassigned —</option>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profiles?.first_name} {m.profiles?.last_name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Summary (brief, non-clinical)</label><textarea value={form.summary} onChange={e => setForm(p => ({ ...p, summary: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="e.g. Recovering from surgery, appreciates visits" /></div>
          <div><label style={labelStyle}>Check-in reminder every (days)</label><input type="number" value={form.checkInIntervalDays} onChange={e => setForm(p => ({ ...p, checkInIntervalDays: parseInt(e.target.value) }))} style={inputStyle} /></div>
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="submit" disabled={saving} className="btn-gold" style={{ fontSize: '0.68rem', opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Add to Registry'}</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
        {(['open', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? 'rgba(201,168,76,0.15)' : 'transparent', border: `1px solid ${filter === f ? '#C9A84C' : 'rgba(184,176,160,0.2)'}`, color: filter === f ? '#C9A84C' : '#B8B0A0', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{f === 'open' ? 'Open & Monitoring' : 'Include Resolved'}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {visible.map(entry => {
          const daysSinceCheckin = daysSince(entry.last_checked_in_at)
          const overdue = daysSinceCheckin === null || daysSinceCheckin >= (entry.check_in_interval_days ?? 14)
          return (
            <div key={entry.id} style={{ background: '#141C2E', border: `1px solid ${overdue && entry.status !== 'resolved' ? 'rgba(231,76,60,0.35)' : 'rgba(201,168,76,0.1)'}`, padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: '#F5F0E8' }}>{entry.person_name}</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: CARE_TYPE_COLOR[entry.care_type], border: `1px solid ${CARE_TYPE_COLOR[entry.care_type]}55`, padding: '2px 8px', borderRadius: '3px' }}>{CARE_TYPE_LABEL[entry.care_type]}</span>
                    <span className={`pill ${entry.status === 'resolved' ? 'pill-active' : entry.status === 'monitoring' ? 'pill-fc' : 'pill-canceled'}`}>{entry.status}</span>
                  </div>
                  {entry.relationship && <div style={{ color: '#B8B0A0', fontSize: '0.78rem', fontStyle: 'italic' }}>{entry.relationship}</div>}
                  {entry.summary && <div style={{ color: '#B8B0A0', fontSize: '0.82rem', marginTop: '6px' }}>{entry.summary}</div>}
                  {entry.assignee && <div style={{ color: '#7BB8D4', fontSize: '0.72rem', marginTop: '6px', fontFamily: 'JetBrains Mono, monospace' }}>Assigned: {entry.assignee.first_name} {entry.assignee.last_name}</div>}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: overdue && entry.status !== 'resolved' ? '#E74C3C' : '#5DBE85', marginBottom: '8px' }}>
                    {daysSinceCheckin === null ? 'Never checked in' : `${daysSinceCheckin}d since last check-in`}
                    {overdue && entry.status !== 'resolved' && ' — overdue'}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button onClick={() => logCheckIn(entry.id)} style={{ background: 'rgba(93,190,133,0.12)', border: '1px solid #5DBE85', color: '#5DBE85', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>Log Check-In</button>
                    {entry.status !== 'resolved' && <button onClick={() => setStatus(entry.id, 'resolved')} style={{ background: 'transparent', border: '1px solid rgba(184,176,160,0.3)', color: '#B8B0A0', padding: '5px 10px', borderRadius: '3px', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>Mark Resolved</button>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {visible.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)' }}>No entries. When a brother needs checking on, or a widow needs care, add them here.</div>}
      </div>
    </div>
  )
}
