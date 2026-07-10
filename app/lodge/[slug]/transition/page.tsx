'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'

/**
 * "Officer transition mode" from the earlier feature discussion, built
 * as what the data actually supports: a real-time digest of everything
 * currently in flight, not a fabricated handoff workflow with states
 * the schema doesn't have (no onboarding_complete flag, no "transition
 * period" concept exists in tenant_members). An incoming officer reads
 * this once and knows what's actually active — pending petitions,
 * upcoming events, overdue care check-ins, outstanding dues — instead
 * of inheriting a file box and a handshake.
 */
export default function TransitionDigestPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = await createClient()

  const [tenant, setTenant] = useState<any>(null)
  const [petitions, setPetitions] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [careOverdue, setCareOverdue] = useState<any[]>([])
  const [duesOutstanding, setDuesOutstanding] = useState<any[]>([])
  const [stalledCandidates, setStalledCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: t } = await supabase.from('tenants').select('id, name, number').eq('slug', slug).single()
      if (!t) { setLoading(false); return }
      setTenant(t)

      const [{ data: p }, { data: e }, { data: care }, { data: due }, { data: candidates }, { data: progress }] = await Promise.all([
        supabase.from('petitions').select('first_name, last_name, status, created_at').eq('tenant_id', t.id).in('status', ['new', 'under_review']).order('created_at'),
        supabase.from('lodge_events').select('id, title, event_date, event_time').eq('tenant_id', t.id).gte('event_date', new Date().toISOString().slice(0, 10)).order('event_date').limit(5),
        supabase.from('care_entries').select('person_name, care_type, last_checked_in_at, check_in_interval_days').eq('tenant_id', t.id).neq('status', 'resolved'),
        supabase.from('tenant_members').select('profiles(first_name, last_name)').eq('tenant_id', t.id).eq('dues_status', 'due').eq('is_active', true),
        supabase.from('tenant_members').select('user_id, degree, profiles(first_name, last_name)').eq('tenant_id', t.id).eq('is_active', true).in('degree', ['EA', 'FC']),
        supabase.from('degree_progress').select('member_id, degree, conferred_date, proficiency_date').eq('tenant_id', t.id),
      ])

      setPetitions(p ?? [])
      setEvents(e ?? [])
      setDuesOutstanding(due ?? [])

      const overdueCare = (care ?? []).filter(c => {
        if (!c.last_checked_in_at) return true
        const days = Math.floor((Date.now() - new Date(c.last_checked_in_at).getTime()) / 86_400_000)
        return days >= (c.check_in_interval_days ?? 14)
      })
      setCareOverdue(overdueCare)

      const progressByKey: Record<string, any> = {}
      for (const pr of progress ?? []) progressByKey[`${pr.member_id}:${pr.degree}`] = pr
      const stalled = (candidates ?? []).filter(c => {
        const pr = progressByKey[`${c.user_id}:${c.degree}`]
        const dates = [pr?.conferred_date, pr?.proficiency_date].filter(Boolean)
        if (dates.length === 0) return true
        const days = Math.floor((Date.now() - new Date(dates.sort().at(-1) + 'T00:00:00').getTime()) / 86_400_000)
        return days >= 45
      })
      setStalledCandidates(stalled)

      setLoading(false)
    }
    load()
  }, [])

  const cardStyle = { background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', padding: '1.5rem', marginBottom: '1.25rem' }
  const cardTitleStyle = { fontFamily: 'Cinzel, serif', fontSize: '0.95rem', color: '#C9A84C', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }
  const emptyStyle = { color: '#5DBE85', fontSize: '0.82rem', fontStyle: 'italic' }
  const itemStyle = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(184,176,160,0.1)', fontSize: '0.85rem' }

  if (loading) return <div style={{ padding: '2rem', color: '#B8B0A0', fontStyle: 'italic' }}>Loading...</div>

  const totalOpenItems = petitions.length + careOverdue.length + stalledCandidates.length

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Transition Digest</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
          Everything currently in flight for {tenant?.name} #{tenant?.number} — read this once and you know what's actually active, not just what's on the calendar.
        </p>
      </div>

      {totalOpenItems > 0 && (
        <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', padding: '14px 18px', marginBottom: '1.5rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', color: '#E74C3C' }}>
          {totalOpenItems} item{totalOpenItems !== 1 ? 's' : ''} need attention across petitions, care check-ins, and candidate progress
        </div>
      )}

      <div style={cardStyle}>
        <div style={cardTitleStyle}>📋 Pending Petitions</div>
        {petitions.length === 0 && <div style={emptyStyle}>Nothing pending.</div>}
        {petitions.map((p, i) => (
          <div key={i} style={itemStyle}>
            <span>{p.first_name} {p.last_name}</span>
            <span style={{ color: '#B8B0A0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{p.status.replace('_', ' ')} · {format(new Date(p.created_at), 'MMM d')}</span>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={cardTitleStyle}>🩺 Care Check-Ins Overdue</div>
        {careOverdue.length === 0 && <div style={emptyStyle}>Everyone's been checked on.</div>}
        {careOverdue.map((c, i) => (
          <div key={i} style={itemStyle}>
            <span>{c.person_name}</span>
            <span style={{ color: '#E74C3C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{c.care_type}</span>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={cardTitleStyle}>🎓 Candidates Needing Follow-Up (45+ days, no progress)</div>
        {stalledCandidates.length === 0 && <div style={emptyStyle}>No one's stalled.</div>}
        {stalledCandidates.map((c: any, i) => (
          <div key={i} style={itemStyle}>
            <span>{c.profiles?.first_name} {c.profiles?.last_name}</span>
            <span style={{ color: '#B8B0A0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{c.degree}</span>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={cardTitleStyle}>📅 Upcoming Meetings</div>
        {events.length === 0 && <div style={emptyStyle}>Nothing scheduled.</div>}
        {events.map(e => (
          <div key={e.id} style={itemStyle}>
            <span>{e.title}</span>
            <span style={{ color: '#B8B0A0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>{format(new Date(e.event_date + 'T12:00:00'), 'MMM d, yyyy')}</span>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={cardTitleStyle}>💰 Dues Outstanding</div>
        {duesOutstanding.length === 0 && <div style={emptyStyle}>Everyone's current.</div>}
        {duesOutstanding.map((m: any, i) => (
          <div key={i} style={itemStyle}><span>{m.profiles?.first_name} {m.profiles?.last_name}</span></div>
        ))}
      </div>

      <p style={{ color: '#B8B0A0', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '1.5rem' }}>
        This page reflects live data, not a snapshot — it will look different in six months than it does today, which is the point.
      </p>
    </div>
  )
}
