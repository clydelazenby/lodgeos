'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Progress = { proficiency_passed: boolean; proficiency_date: string | null; conferred_date: string | null } | null

function daysSinceProgress(progress: Progress): number | null {
  if (!progress) return null
  const dates = [progress.conferred_date, progress.proficiency_date].filter(Boolean) as string[]
  if (dates.length === 0) return null
  const mostRecent = dates.sort().at(-1)!
  return Math.floor((Date.now() - new Date(mostRecent + 'T00:00:00').getTime()) / 86_400_000)
}

const STALL_THRESHOLD_DAYS = 45

export function ProficiencyControl({
  tenantId, memberId, degree, progress,
}: { tenantId: string; memberId: string; degree: 'EA' | 'FC' | 'MM'; progress: Progress }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const passed = progress?.proficiency_passed ?? false
  const stallDays = daysSinceProgress(progress)
  const isStalled = !passed && stallDays !== null && stallDays >= STALL_THRESHOLD_DAYS

  const toggle = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/degrees/update-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, memberId, degree, proficiencyPassed: !passed }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Update failed')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: passed ? 'rgba(93,190,133,0.12)' : 'transparent',
          border: `1px solid ${passed ? '#5DBE85' : 'rgba(201,168,76,0.3)'}`,
          color: passed ? '#5DBE85' : '#B8B0A0',
          padding: '4px 10px', borderRadius: '3px', cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.05em',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {passed ? '✓ Proficient' : saving ? 'Saving…' : 'Mark Proficient'}
      </button>
      {isStalled && (
        <span style={{ color: '#E74C3C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.04em' }}>
          ⚠ {stallDays}d no progress
        </span>
      )}
      {error && <span style={{ color: '#E74C3C', fontSize: '0.56rem' }}>{error}</span>}
    </div>
  )
}
