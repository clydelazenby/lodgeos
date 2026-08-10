'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignmentStatus, statusPill, statusLabel, dueLabel, selfCompletable, type Assignment } from '@/lib/assignments'

/**
 * What a brother has been asked to do, and what he has finished.
 *
 * The "what he has finished" half is not decoration. Work given at a
 * meeting and never written down is work nobody can prove they did —
 * and a candidate two years into a slow progression has genuinely
 * forgotten what he has already got through.
 *
 * HE CANNOT TICK HIS DEGREE WORK. A curriculum step is signed off by an
 * officer who has heard it; that is what a proficiency means. The
 * checkbox is simply absent on those, and the row says where it is
 * signed off instead — a disabled control with no explanation reads as
 * a bug.
 */
export function MyAssignments({
  tenantId,
  assignments,
  signedOffStepIds,
  documents,
}: {
  tenantId: string
  assignments: Assignment[]
  signedOffStepIds: string[]
  documents: Record<string, string>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [locallyDone, setLocallyDone] = useState<Record<string, boolean>>({})

  const done = new Set(signedOffStepIds)

  const withStatus = assignments.map((a) => {
    const override = locallyDone[a.id]
    const effective = override === undefined ? a : { ...a, completed_at: override ? new Date().toISOString() : null }
    return { a: effective, status: assignmentStatus(effective, done) }
  })

  const open = withStatus.filter(({ status }) => status === 'open' || status === 'overdue')
  const finished = withStatus.filter(({ status }) => status === 'completed')

  const toggle = async (a: Assignment, completed: boolean) => {
    setBusy(a.id)
    setError('')
    setLocallyDone((p) => ({ ...p, [a.id]: completed }))
    try {
      const res = await fetch('/api/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, assignmentId: a.id, completed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setLocallyDone((p) => ({ ...p, [a.id]: !completed }))
        setError(data.error || 'Could not record that.')
        return
      }
      router.refresh()
    } catch (e: any) {
      setLocallyDone((p) => ({ ...p, [a.id]: !completed }))
      setError(e?.message || 'Could not record that.')
    } finally {
      setBusy(null)
    }
  }

  const Row = ({ a, status }: { a: Assignment; status: ReturnType<typeof assignmentStatus> }) => {
    const material = a.document_id ? documents[a.document_id] : null
    const isDone = status === 'completed'
    return (
      <div style={{ padding: '0.9rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', gap: '0.9rem', alignItems: 'flex-start', flexWrap: 'wrap', opacity: busy === a.id ? 0.55 : 1 }}>
        {selfCompletable(a) ? (
          <input
            type="checkbox"
            checked={isDone}
            disabled={busy === a.id}
            onChange={(e) => toggle(a, e.target.checked)}
            aria-label={a.title}
            style={{ accentColor: '#C9A84C', marginTop: 4 }}
          />
        ) : (
          <span aria-hidden="true" style={{ color: isDone ? '#5DBE85' : '#3A4155', marginTop: 2 }}>
            {isDone ? '✓' : '○'}
          </span>
        )}

        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem', color: isDone ? '#918879' : '#F5F0E8', textDecoration: isDone ? 'line-through' : 'none' }}>
            {a.title}
          </div>
          {a.description && (
            <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: '#B8B0A0' }}>{a.description}</div>
          )}
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: '#918879', marginTop: 3 }}>
            {a.assigned_by_name ? `ASKED BY ${a.assigned_by_name.toUpperCase()}` : 'FROM THE LODGE'}
            {dueLabel(a.due_date) ? ` · ${dueLabel(a.due_date)!.toUpperCase()}` : ''}
            {!selfCompletable(a) ? ' · AN OFFICER SIGNS THIS OFF' : ''}
          </div>
          {material && (
            <a href={`/api/documents/${a.document_id}/download`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>
              📄 {material}
            </a>
          )}
        </div>

        <span className={`pill ${statusPill(status)}`}>{statusLabel(status)}</span>
      </div>
    )
  }

  return (
    <div>
      {error && (
        <div style={{ background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', color: '#EC5B4B', padding: '10px 14px', borderRadius: 4, marginBottom: '1rem', fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem' }}>
          {error}
        </div>
      )}

      <div className="data-box">
        <div className="data-box-head">
          <span>Asked of You</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>{open.length}</span>
        </div>
        {open.length === 0 ? (
          <div style={{ padding: '2.2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontFamily: 'Crimson Pro, serif' }}>
            Nothing outstanding.
          </div>
        ) : open.map(({ a, status }) => <Row key={a.id} a={a} status={status} />)}
      </div>

      {/* Kept and shown, not archived away. A candidate two years into a
          slow progression has genuinely forgotten what he got through,
          and work nobody wrote down is work he cannot prove he did. */}
      <div className="data-box">
        <div className="data-box-head">
          <span>Completed</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>{finished.length}</span>
        </div>
        {finished.length === 0 ? (
          <div style={{ padding: '2.2rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontFamily: 'Crimson Pro, serif' }}>
            Nothing yet.
          </div>
        ) : finished.map(({ a, status }) => <Row key={a.id} a={a} status={status} />)}
      </div>
    </div>
  )
}
