'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignmentStatus, statusPill, statusLabel, dueLabel, canSubmit, selfCompletable, needsSignOff, type Assignment } from '@/lib/assignments'
import { callApi, errorMessage } from '@/lib/clientFetch'

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
  const [locallySubmitted, setLocallySubmitted] = useState<Record<string, boolean>>({})
  const [locallyCompleted, setLocallyCompleted] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState('')

  const done = new Set(signedOffStepIds)

  const withStatus = assignments.map((a) => {
    const submittedOverride = locallySubmitted[a.id]
    const completedOverride = locallyCompleted[a.id]
    const effective = {
      ...a,
      ...(submittedOverride === undefined
        ? {}
        : { submitted_at: submittedOverride ? new Date().toISOString() : null }),
      ...(completedOverride === undefined
        ? {}
        : { completed_at: completedOverride ? new Date().toISOString() : null }),
    }
    return { a: effective, status: assignmentStatus(effective, done) }
  })

  const open = withStatus.filter(({ status }) =>
    status === 'open' || status === 'overdue' || status === 'awaiting' || status === 'declined')
  const finished = withStatus.filter(({ status }) => status === 'completed')

  /**
   * "I have done it" — a claim, not a completion.
   *
   * An officer decides whether it stands, and is emailed the moment
   * this is tapped. That is true of a plain task as well as degree
   * work: work nobody was told about might as well not have been
   * finished, and a proficiency the candidate marks off himself is not
   * a proficiency.
   */
  /**
   * A plain task, finished. No queue, no wait — the man who was asked
   * is the man who knows. The officer who gave it out is emailed so he
   * knows too, but nothing waits on him.
   */
  const complete = async (a: Assignment, done: boolean) => {
    setBusy(a.id)
    setError('')
    setNotice('')
    setLocallyCompleted((p) => ({ ...p, [a.id]: done }))
    try {
      await callApi('/api/assignments', {
        method: 'PATCH',
        body: { tenantId, assignmentId: a.id, action: done ? 'complete' : 'reopen' },
      })
      router.refresh()
    } catch (e) {
      setLocallyCompleted((p) => ({ ...p, [a.id]: !done }))
      setError(errorMessage(e, 'Could not record that.'))
    } finally {
      setBusy(null)
    }
  }

  const submit = async (a: Assignment) => {
    setBusy(a.id)
    setError('')
    setNotice('')
    setLocallySubmitted((p) => ({ ...p, [a.id]: true }))
    try {
      const data = await callApi('/api/assignments', {
        method: 'PATCH',
        body: { tenantId, assignmentId: a.id, action: 'submit' },
      })
      setNotice(data.message || 'Sent for sign-off.')
      router.refresh()
    } catch (e) {
      setLocallySubmitted((p) => ({ ...p, [a.id]: false }))
      setError(errorMessage(e, 'Could not send that for sign-off.'))
    } finally {
      setBusy(null)
    }
  }

  const Row = ({ a, status }: { a: Assignment; status: ReturnType<typeof assignmentStatus> }) => {
    const material = a.document_id ? documents[a.document_id] : null
    const isDone = status === 'completed'
    return (
      <div style={{ padding: '0.9rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', gap: '0.9rem', alignItems: 'flex-start', flexWrap: 'wrap', opacity: busy === a.id ? 0.55 : 1 }}>
        {/* A TASK HAS A CHECKBOX; DEGREE WORK DOES NOT.
            The tick is the whole interaction for something he finishes
            himself. For a proficiency there is nothing to tick — it
            goes to an officer — so offering a box he cannot use would
            read as broken. */}
        {selfCompletable(a) ? (
          <input
            type="checkbox"
            checked={isDone}
            disabled={busy === a.id}
            onChange={(e) => complete(a, e.target.checked)}
            aria-label={a.title}
            style={{ accentColor: '#C9A84C', marginTop: 4 }}
          />
        ) : (
          <span aria-hidden="true" style={{ color: isDone ? '#5DBE85' : status === 'awaiting' ? '#C9A84C' : '#3A4155', marginTop: 2 }}>
            {isDone ? '✓' : status === 'awaiting' ? '⏳' : '○'}
          </span>
        )}

        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem', color: isDone ? '#918879' : '#F5F0E8', textDecoration: isDone ? 'line-through' : 'none' }}>
            {a.title}
          </div>
          {a.description && (
            <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: '#B8B0A0' }}>{a.description}</div>
          )}

          {/* THE REASON IS THE POINT OF SENDING IT BACK. A proficiency
              returned without one teaches nothing except that he
              failed, which is the opposite of what a mentor is for. */}
          {status === 'declined' && (
            <div style={{ marginTop: 6, background: 'rgba(231,76,60,0.07)', border: '1px solid rgba(231,76,60,0.22)', borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.53rem', letterSpacing: '0.12em', color: '#EC5B4B', marginBottom: 3 }}>
                SENT BACK{a.declined_by_name ? ` BY ${a.declined_by_name.toUpperCase()}` : ''}
              </div>
              <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: '#E8E2D5' }}>
                {a.decline_note || 'No note was left — speak to your mentor about what is still wanting.'}
              </div>
            </div>
          )}

          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', color: '#918879', marginTop: 3 }}>
            {a.assigned_by_name ? `ASKED BY ${a.assigned_by_name.toUpperCase()}` : 'FROM THE LODGE'}
            {dueLabel(a.due_date) ? ` · ${dueLabel(a.due_date)!.toUpperCase()}` : ''}
            {needsSignOff(a) ? ' · DEGREE WORK · AN OFFICER SIGNS THIS OFF' : ''}
          </div>

          {material && (
            <a href={`/api/documents/${a.document_id}/download`} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#C9A84C', textDecoration: 'none' }}>
              📄 {material}
            </a>
          )}

          {canSubmit(a, status) && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => submit(a)}
                disabled={busy === a.id}
                style={{
                  background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.45)',
                  color: '#C9A84C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem',
                  letterSpacing: '0.12em', padding: '7px 11px', borderRadius: 3, cursor: 'pointer',
                }}
              >
                {status === 'declined' ? "I'VE PUT THAT RIGHT" : "I'VE DONE THIS"}
              </button>
            </div>
          )}

          {status === 'awaiting' && (
            <div style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.85rem', color: '#918879', marginTop: 6 }}>
              With an officer. You will hear when it is signed off.
            </div>
          )}
        </div>

        <span className={`pill ${statusPill(status)}`}>{statusLabel(status, a)}</span>
      </div>
    )
  }

  return (
    <div>
      {notice && (
        <div style={{ background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.25)', color: '#5DBE85', padding: '10px 14px', borderRadius: 4, marginBottom: '1rem', fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem' }}>
          {notice}
        </div>
      )}

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
