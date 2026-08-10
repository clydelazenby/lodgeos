'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * The visitors' column of the Tyler's register.
 *
 * attendance keys off a profile id, so before this a visiting brother
 * could not be recorded at all. The register has had a column for him
 * for three hundred years; knowing who came, from where, and
 * reciprocating is half of what keeps neighbouring lodges in relation
 * to one another — and the minutes of a stated communication
 * traditionally name the visitors, which the minutes this app drafts
 * could not do.
 *
 * Deliberately quick to use. This is filled in at a door, standing up,
 * often on a phone, while a man waits — so the name is the only
 * required field and everything else can be added later or not at all.
 */
export function VisitorRegister({
  tenantId,
  eventId,
  canEdit,
}: {
  tenantId: string
  eventId: string
  canEdit: boolean
}) {
  const supabase = createClient()
  const [visitors, setVisitors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', visitingFrom: '', title: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const { data } = await supabase
      .from('event_visitors')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('event_id', eventId)
      .order('created_at')
    setVisitors(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the meeting
  }, [eventId])

  const sign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/attendance/visitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, eventId, ...form }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not sign him in.')
        return
      }
      setVisitors((prev) => [...prev, data.visitor])
      // Cleared entirely rather than keeping the lodge name: visitors
      // usually arrive from different lodges, and a stale "Corinthian
      // #45" left in the box is how the wrong lodge gets recorded.
      setForm({ name: '', visitingFrom: '', title: '' })
    } catch (err: any) {
      setError(err?.message || 'Could not sign him in.')
    } finally {
      setBusy(false)
    }
  }

  const strike = async (id: string) => {
    setVisitors((prev) => prev.filter((v) => v.id !== id))
    await fetch('/api/attendance/visitors', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, visitorId: id }),
    })
  }

  const input = (
    key: keyof typeof form,
    placeholder: string,
    flex: number,
    required = false
  ) => (
    <input
      value={form[key]}
      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
      placeholder={placeholder}
      required={required}
      style={{
        flex,
        minWidth: 120,
        background: '#0A0E1A',
        border: '1px solid rgba(201,168,76,0.2)',
        color: '#F5F0E8',
        padding: '9px 11px',
        borderRadius: 4,
        fontFamily: 'Crimson Pro, serif',
        // 16px stops iOS zooming the page when this is focused, which
        // matters more here than anywhere: this form is used one-handed
        // at a door.
        fontSize: '16px',
      }}
    />
  )

  return (
    <div className="data-box">
      <div className="data-box-head">
        <span>Visiting Brethren</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
          {visitors.length}
        </span>
      </div>

      {canEdit && (
        <form
          onSubmit={sign}
          style={{ padding: '1rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.08)', display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}
        >
          {input('name', 'Name', 2, true)}
          {input('visitingFrom', 'From what lodge?', 2)}
          {input('title', 'Title (optional)', 1)}
          <button
            type="submit"
            disabled={busy || !form.name.trim()}
            className="btn-gold"
            style={{ fontSize: '0.68rem', opacity: busy || !form.name.trim() ? 0.5 : 1, whiteSpace: 'nowrap' }}
          >
            {busy ? 'Signing…' : 'Sign In'}
          </button>
        </form>
      )}

      {error && (
        <div style={{ padding: '0.7rem 1.4rem', color: '#EC5B4B', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic' }}>Loading…</div>
      ) : visitors.length === 0 ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontFamily: 'Crimson Pro, serif' }}>
          No visitors recorded for this meeting.
        </div>
      ) : (
        visitors.map((v) => (
          <div
            key={v.id}
            style={{ padding: '0.75rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', alignItems: 'baseline', gap: '0.9rem', flexWrap: 'wrap' }}
          >
            <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem', color: '#F5F0E8' }}>
              {v.title ? `${v.title} ` : ''}{v.name}
            </span>
            <span style={{ flex: 1, minWidth: 120, fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.88rem', color: '#B8B0A0' }}>
              {v.visiting_from || 'lodge not given'}
              {v.jurisdiction ? `, ${v.jurisdiction}` : ''}
            </span>
            {canEdit && (
              <button
                onClick={() => strike(v.id)}
                aria-label={`Remove ${v.name} from the register`}
                style={{ background: 'none', border: 'none', color: '#918879', cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em' }}
              >
                STRIKE
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
