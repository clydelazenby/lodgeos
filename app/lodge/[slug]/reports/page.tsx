'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect } from 'react'

export default function LodgeReportsPage() {
  const params = useParams()
  const slug = params.slug as string
  const [tenant, setTenant] = useState<any>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [tbMonth, setTbMonth] = useState(new Date().getMonth() + 1)
  const [tbYear, setTbYear] = useState(new Date().getFullYear())
  const [tbAnnouncement, setTbAnnouncement] = useState('')
  const [tbGenerating, setTbGenerating] = useState(false)
  const [tbError, setTbError] = useState('')
  const supabase = await createClient()

  useEffect(() => {
    supabase.from('tenants').select('id, name').eq('slug', slug).single().then(({ data }) => setTenant(data))
  }, [])

  const downloadPdf = async (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateTrestleboard = async () => {
    setTbGenerating(true)
    setTbError('')
    try {
      const res = await fetch('/api/reports/trestleboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, month: tbMonth, year: tbYear, announcement: tbAnnouncement }),
      })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Trestleboard generation failed')
      }
      const blob = await res.blob()
      await downloadPdf(blob, `Trestleboard-${tbYear}-${String(tbMonth).padStart(2, '0')}.pdf`)
    } catch (e: any) {
      setTbError(e.message)
    } finally {
      setTbGenerating(false)
    }
  }

  const generateAnnualReturn = async () => {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch('/api/reports/annual-return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, year }),
      })
      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error || 'Report generation failed')
      }
      const blob = await res.blob()
      await downloadPdf(blob, `Annual-Return-${year}.pdf`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const yearOptions = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: '#F5F0E8', marginBottom: '0.25rem' }}>Reports</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#B8B0A0' }}>Generated directly from lodge records — no manual tallying</p>
      </div>

      <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', padding: '2rem', marginBottom: '1.5rem' }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#C9A84C', marginBottom: '0.5rem' }}>Grand Lodge Annual Return</div>
        <p style={{ color: '#B8B0A0', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          Assembles membership counts, degrees conferred, petition outcomes, and dues collected for a
          selected year into a single PDF. This is a preparation aid, not a substitute for your
          jurisdiction's official return form — figures should be reviewed before submission.
        </p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} style={{ background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', outline: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={generateAnnualReturn} disabled={generating || !tenant} className="btn-gold" style={{ fontSize: '0.7rem', opacity: generating || !tenant ? 0.6 : 1 }}>
            {generating ? 'Generating…' : 'Generate & Download PDF'}
          </button>
        </div>
        {error && <div style={{ color: '#E74C3C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', marginTop: '10px' }}>{error}</div>}
      </div>

      <div style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.1)', padding: '2rem' }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1rem', color: '#C9A84C', marginBottom: '0.5rem' }}>Monthly Trestleboard</div>
        <p style={{ color: '#B8B0A0', fontSize: '0.85rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
          A PDF newsletter assembled from this month's calendar and any member birthdays on record.
          Add a short note from the Secretary if you'd like one included.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '1rem' }}>
          <select value={tbMonth} onChange={e => setTbMonth(parseInt(e.target.value))} style={{ background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', outline: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' })}</option>)}
          </select>
          <select value={tbYear} onChange={e => setTbYear(parseInt(e.target.value))} style={{ background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', outline: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <textarea
          value={tbAnnouncement}
          onChange={e => setTbAnnouncement(e.target.value)}
          placeholder="Optional note from the Secretary to include in this month's issue..."
          rows={2}
          style={{ width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '10px 14px', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', outline: 'none', borderRadius: '4px', resize: 'vertical', marginBottom: '1rem', boxSizing: 'border-box' }}
        />
        <button onClick={generateTrestleboard} disabled={tbGenerating || !tenant} className="btn-gold" style={{ fontSize: '0.7rem', opacity: tbGenerating || !tenant ? 0.6 : 1 }}>
          {tbGenerating ? 'Generating…' : 'Generate & Download PDF'}
        </button>
        {tbError && <div style={{ color: '#E74C3C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem', marginTop: '10px' }}>{tbError}</div>}
      </div>
    </div>
  )
}
