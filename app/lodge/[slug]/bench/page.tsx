'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

/**
 * "Ritual bench depth" from the earlier feature discussion, built as
 * what the real data actually supports. There is no structured "floor
 * positions" table, no proficiency-per-position tracking, and no
 * succession field anywhere in this schema — lodge_role is free text
 * (see schema.sql comment: "Worshipful Master", "Secretary" etc, with
 * no fixed list). Building a fake bench-depth tracking system nobody
 * has populated would be worse than not building it — an empty
 * "who's qualified for this" grid looks broken, not honest.
 *
 * What this page does instead: groups the current active roster by
 * their lodge_role, and separately surfaces every Master Mason who
 * doesn't currently hold a named office — the actual pool a WM would
 * draw from on a Tuesday night when someone's out sick. This directly
 * answers the real question ("who else could step in") using data that
 * genuinely exists, without pretending to track qualification data that
 * was never entered anywhere.
 */
export default function BenchCoveragePage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = await createClient()

  const [tenant, setTenant] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: t } = await supabase.from('tenants').select('id, name').eq('slug', slug).single()
      if (!t) { setLoading(false); return }
      setTenant(t)
      const { data: m } = await supabase
        .from('tenant_members')
        .select('lodge_role, degree, profiles(first_name, last_name)')
        .eq('tenant_id', t.id)
        .eq('is_active', true)
        .order('lodge_role')
      setMembers(m ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div style={{ padding: '2rem', color: '#B8B0A0', fontStyle: 'italic' }}>Loading...</div>

  const withOffice = members.filter(m => m.lodge_role?.trim())
  const withoutOffice = members.filter(m => !m.lodge_role?.trim() && m.degree === 'MM')

  const byOffice: Record<string, any[]> = {}
  for (const m of withOffice) {
    const key = m.lodge_role.trim()
    if (!byOffice[key]) byOffice[key] = []
    byOffice[key].push(m)
  }

  const cardStyle = { background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', padding: '1.25rem 1.5rem', marginBottom: '10px' }

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Officer Coverage</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>
          Current roster by office, and Master Masons without a named office — the practical pool to draw from if someone's out.
        </p>
      </div>

      <p style={{ color: '#B8B0A0', fontSize: '0.78rem', fontStyle: 'italic', marginBottom: '1.5rem', lineHeight: 1.5 }}>
        This does not track who is proficient in which specific floor work — that's mouth-to-ear
        knowledge this system deliberately doesn't record. It shows who currently holds which office
        and who else is available, as a starting point for the WM's own judgment, not a replacement for it.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.15em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '10px' }}>Named Offices ({Object.keys(byOffice).length})</div>
        {Object.entries(byOffice).map(([office, holders]) => (
          <div key={office} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.9rem', color: '#F5F0E8' }}>{office}</span>
              {holders.length > 1 && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#7BB8D4' }}>{holders.length} brothers</span>}
            </div>
            {holders.map((h, i) => (
              <div key={i} style={{ color: '#B8B0A0', fontSize: '0.82rem', marginTop: '4px' }}>{h.profiles?.first_name} {h.profiles?.last_name}</div>
            ))}
          </div>
        ))}
        {Object.keys(byOffice).length === 0 && <div style={{ ...cardStyle, color: '#B8B0A0', fontStyle: 'italic', textAlign: 'center' }}>No members have a Lodge Role set yet — add one from the Members page.</div>}
      </div>

      <div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.15em', color: '#C9A84C', textTransform: 'uppercase', marginBottom: '10px' }}>
          Master Masons Without a Named Office ({withoutOffice.length}) — the practical fill-in pool
        </div>
        {withoutOffice.length === 0 && <div style={{ ...cardStyle, color: '#B8B0A0', fontStyle: 'italic', textAlign: 'center' }}>Every Master Mason currently holds a named office.</div>}
        {withoutOffice.length > 0 && (
          <div style={{ ...cardStyle, display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {withoutOffice.map((m, i) => (
              <span key={i} style={{ background: 'rgba(93,190,133,0.1)', border: '1px solid rgba(93,190,133,0.25)', color: '#5DBE85', padding: '5px 12px', borderRadius: '4px', fontSize: '0.82rem' }}>{m.profiles?.first_name} {m.profiles?.last_name}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
