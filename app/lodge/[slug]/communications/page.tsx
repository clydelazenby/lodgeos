'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'

export default function LodgeCommunicationsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [tenant, setTenant] = useState<any>(null)
  const [comms, setComms] = useState<any[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentSummary, setSentSummary] = useState('')
  const [sendError, setSendError] = useState('')
  const [form, setForm] = useState({ subject: '', body: '', recipient_group: 'all' })
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: t } = await supabase.from('tenants').select('id, name').eq('slug', slug).single()
      if (!t) return
      setTenant(t)
      const { data: c } = await supabase.from('communications').select('*, profiles(first_name, last_name)').eq('tenant_id', t.id).order('created_at', { ascending: false })
      setComms(c ?? [])
    }
    load()
  }, [])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setSending(true)
    setSendError('')

    const res = await fetch('/api/communications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: tenant.id,
        subject: form.subject,
        body: form.body,
        recipientGroup: form.recipient_group,
      }),
    })
    const result = await res.json()

    if (!res.ok || !result.success) {
      setSendError(result.error || `Send failed — 0 of ${result.total ?? '?'} brothers reached.`)
      setSending(false)
      return
    }

    if (result.communication) setComms(prev => [result.communication, ...prev])
    setForm({ subject: '', body: '', recipient_group: 'all' })
    setSent(true)
    setSentSummary(`Sent to ${result.sent} of ${result.total} brothers${result.failed ? ` (${result.failed} could not be reached)` : ''}.`)
    setTimeout(() => setSent(false), 4000)
    setSending(false)
  }

  const groupLabels: Record<string, string> = {
    all: 'All Brothers',
    mm_only: 'Master Masons Only',
    candidates: 'Candidates (EA & FC)',
    dues_outstanding: 'Dues Outstanding',
  }

  const inputStyle = { width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', outline: 'none', borderRadius: '4px' }
  const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em', color: '#C9A84C', textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block' }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Communications</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Send notices and announcements to lodge brothers</p>
      </div>

      {/* Compose */}
      <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.15)', padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#C9A84C', marginBottom: '1.5rem' }}>✉ Compose Notice</div>
        {sent && (
          <div style={{ background: 'rgba(39,174,96,0.15)', border: '1px solid rgba(39,174,96,0.3)', color: '#5DBE85', padding: '10px 14px', borderRadius: '4px', marginBottom: '1rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
            ✓ {sentSummary || 'NOTICE SENT'}
          </div>
        )}
        {sendError && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)', color: '#E74C3C', padding: '10px 14px', borderRadius: '4px', marginBottom: '1rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.08em' }}>
            ✕ {sendError}
          </div>
        )}
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Subject *</label>
              <input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Reminder — Stated Communication this Tuesday" style={inputStyle} required />
            </div>
            <div>
              <label style={labelStyle}>Send To</label>
              <select value={form.recipient_group} onChange={e => setForm(p => ({ ...p, recipient_group: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                {Object.entries(groupLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Message *</label>
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={5} placeholder="Write your message to the brethren..." style={{ ...inputStyle, resize: 'vertical' }} required />
          </div>
          <div>
            <button type="submit" disabled={sending} className="btn-gold" style={{ fontSize: '0.7rem', opacity: sending ? 0.7 : 1 }}>
              {sending ? 'Sending...' : `Send to ${groupLabels[form.recipient_group]}`}
            </button>
          </div>
        </form>
      </div>

      {/* History */}
      <div className="data-box">
        <div className="data-box-head">Sent Communications</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Date', 'Subject', 'Sent By', 'Recipients'].map(h => <th key={h} className="dash-th">{h}</th>)}</tr></thead>
          <tbody>
            {comms.map((c: any) => (
              <tr key={c.id}>
                <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: '#B8B0A0', whiteSpace: 'nowrap' }}>
                  {format(new Date(c.created_at), 'MMM d, yyyy')}
                </td>
                <td className="dash-td">{c.subject}</td>
                <td className="dash-td" style={{ color: '#B8B0A0', fontSize: '0.85rem' }}>
                  {c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : '—'}
                </td>
                <td className="dash-td"><span className="pill pill-ea">{groupLabels[c.recipient_group] ?? c.recipient_group}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {comms.length === 0 && <div style={{ padding: '3rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>No communications sent yet.</div>}
      </div>
    </div>
  )
}
