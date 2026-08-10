'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { completion, nextStep, DEGREE_TITLE, type CurriculumDegree, type Step } from '@/lib/curriculum'

/**
 * Where each candidate has actually got to.
 *
 * The Degrees page could previously say only that a man was conferred
 * on one date and passed his proficiency on another. Between those two
 * facts sits months of work that nobody could see, which is why
 * "stalled" was defined as "no progress recorded in 45 days" — a
 * symptom standing in for an answer nobody had.
 *
 * A step is signed off by an officer who heard it, never by the
 * candidate; the route refuses a self sign-off outright, because
 * somebody else hearing it is the whole meaning of a proficiency.
 */
export function CandidateCurriculum({
  tenantId,
  memberId,
  memberName,
  degree,
  steps,
  completedStepIds,
  canSignOff,
}: {
  tenantId: string
  memberId: string
  memberName: string
  degree: CurriculumDegree
  steps: Step[]
  completedStepIds: string[]
  canSignOff: boolean
}) {
  const router = useRouter()
  const [done, setDone] = useState<Set<string>>(new Set(completedStepIds))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const forDegree = steps
    .filter((s) => s.degree === degree)
    .sort((a, b) => a.sort_order - b.sort_order)

  const stats = completion(forDegree, done)
  const next = nextStep(forDegree, done)

  const toggle = async (stepId: string, completed: boolean) => {
    setBusy(stepId)
    setError('')
    // Moved before the round trip: signing off a catechism is a dozen
    // taps in a row, and a spinner between each would make the officer
    // wait on the network to do paperwork he has already done.
    setDone((prev) => {
      const nextSet = new Set(prev)
      if (completed) nextSet.add(stepId)
      else nextSet.delete(stepId)
      return nextSet
    })
    try {
      const res = await fetch('/api/curriculum', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, memberId, stepId, completed }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Put it back. An optimistic update that silently keeps a
        // rejected sign-off is worse than no optimism at all.
        setDone((prev) => {
          const revert = new Set(prev)
          if (completed) revert.delete(stepId)
          else revert.add(stepId)
          return revert
        })
        setError(data.error || 'Could not record that.')
        return
      }
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Could not record that.')
    } finally {
      setBusy(null)
    }
  }

  if (forDegree.length === 0) {
    return (
      <div style={{ padding: '0.9rem 0', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#918879', fontSize: '0.88rem' }}>
        No {DEGREE_TITLE[degree]} curriculum written yet — set one up under Documents → Degree
        Curriculum and his progress will show here.
      </div>
    )
  }

  return (
    <div style={{ padding: '0.6rem 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
        <div style={{ flex: 1, minWidth: 140, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${stats.percent}%`, background: '#C9A84C', borderRadius: 2, transition: 'width 0.25s' }} />
        </div>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>
          {stats.done}/{stats.total}
        </span>
      </div>

      {next ? (
        <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: '#B8B0A0', marginBottom: '0.6rem' }}>
          Next: <span style={{ color: '#F5F0E8' }}>{next.title}</span>
        </div>
      ) : (
        <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: '#5DBE85', marginBottom: '0.6rem' }}>
          Every required step complete.
        </div>
      )}

      {error && (
        <div style={{ color: '#EC5B4B', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', marginBottom: '0.5rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {forDegree.map((s) => {
          const isDone = done.has(s.id)
          return (
            <label
              key={s.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '5px 0',
                cursor: canSignOff ? 'pointer' : 'default',
                opacity: busy === s.id ? 0.55 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={isDone}
                disabled={!canSignOff || busy === s.id}
                onChange={(e) => toggle(s.id, e.target.checked)}
                aria-label={`${s.title} for ${memberName}`}
                style={{ accentColor: '#C9A84C', marginTop: 3 }}
              />
              <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: isDone ? '#918879' : '#E8E2D5', textDecoration: isDone ? 'line-through' : 'none' }}>
                {s.title}
                {!s.required && <span style={{ fontStyle: 'italic', color: '#918879' }}> · optional</span>}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
