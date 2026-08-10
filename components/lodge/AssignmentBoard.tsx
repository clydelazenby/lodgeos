'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { assignmentStatus, statusPill, statusLabel, dueLabel, type Assignment } from '@/lib/assignments'
import { CURRICULUM_DEGREES, DEGREE_TITLE } from '@/lib/curriculum'
import { callApi, errorMessage } from '@/lib/clientFetch'

/**
 * Giving work out, and seeing what is outstanding.
 *
 * The lodge could describe a degree's work and record that a candidate
 * had done a step, but it could not GIVE anyone anything — a Master
 * asking a brother to look into the roof happened in speech at a
 * meeting, and was remembered or it was not.
 *
 * Two shapes of assignment, and the difference matters throughout:
 * a plain task the brother marks done himself, and a curriculum step an
 * officer signs off once he has heard it. See lib/assignments.ts.
 */
export function AssignmentBoard({
  slug,
  tenantId,
  members,
  assignments,
  signedOffByMember,
  documents,
  curriculumCounts,
}: {
  slug: string
  tenantId: string
  members: { user_id: string; name: string; degree: string; email: string | null }[]
  assignments: (Assignment & { assigned_to: string })[]
  /** step ids each brother has been signed off on, keyed by user id */
  signedOffByMember: Record<string, string[]>
  documents: { id: string; name: string }[]
  curriculumCounts: Record<string, number>
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'awaiting' | 'open' | 'done'>('awaiting')
  const [declining, setDeclining] = useState<string | null>(null)
  const [declineNote, setDeclineNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({
    memberId: '', mode: 'task' as 'task' | 'plan',
    title: '', description: '', dueDate: '', documentId: '', degree: 'EA', notify: true,
  })

  const statusOf = (a: Assignment & { assigned_to: string }) =>
    assignmentStatus(a, new Set(signedOffByMember[a.assigned_to] ?? []))

  const rows = useMemo(() => {
    return assignments
      .map((a) => ({ a, status: statusOf(a) }))
      .filter(({ status }) =>
        tab === 'awaiting' ? status === 'awaiting'
        : tab === 'open' ? status === 'open' || status === 'overdue' || status === 'declined'
        : status === 'completed' || status === 'cancelled')
      // Overdue first, then soonest due, then newest. What needs
      // chasing should not be below what does not.
      .sort((x, y) => {
        if (x.status === 'overdue' && y.status !== 'overdue') return -1
        if (y.status === 'overdue' && x.status !== 'overdue') return 1
        const dx = x.a.due_date ?? '9999'
        const dy = y.a.due_date ?? '9999'
        if (dx !== dy) return dx.localeCompare(dy)
        return y.a.created_at.localeCompare(x.a.created_at)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, signedOffByMember, tab])

  // The queue this feature exists to serve: brethren waiting on an
  // officer's decision. Surfaced as a count on the tab, because a
  // proficiency sitting unheard for a fortnight is the failure mode.
  const awaitingCount = assignments.filter((a) => statusOf(a) === 'awaiting').length

  const nameOf = (userId: string) =>
    members.find((m) => m.user_id === userId)?.name ?? 'A brother'

  const assign = async () => {
    if (!form.memberId) { setError('Choose a brother.'); return }
    if (form.mode === 'task' && !form.title.trim()) { setError('A task needs a title.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await callApi('/api/assignments', {
        body: {
          tenantId,
          memberId: form.memberId,
          notify: form.notify,
          dueDate: form.dueDate || null,
          ...(form.mode === 'plan'
            ? { degree: form.degree }
            : { title: form.title, description: form.description, documentId: form.documentId || null }),
        },
      })
      setNotice(data.message)
      setForm((p) => ({ ...p, title: '', description: '', documentId: '' }))
      router.refresh()
    } catch (e) {
      setError(errorMessage(e, 'Could not assign that.'))
    } finally { setBusy(false) }
  }

  const act = async (assignmentId: string, body: any) => {
    setBusy(true); setError('')
    try {
      await callApi('/api/assignments', { method: 'PATCH', body: { tenantId, assignmentId, ...body } })
      router.refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally { setBusy(false) }
  }

  const label = (t: string) => (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0', marginBottom: 4 }}>{t}</div>
  )
  const input: React.CSSProperties = {
    width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)',
    color: '#F5F0E8', padding: '9px 11px', borderRadius: 4,
    fontFamily: 'Crimson Pro, serif', fontSize: '16px',
  }

  const chosen = members.find((m) => m.user_id === form.memberId)

  return (
    <div>
      <div className="data-box">
        <div className="data-box-head"><span>Assign</span></div>
        <div style={{ padding: '1.1rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            {label('TO WHOM')}
            <select value={form.memberId} onChange={(e) => setForm(p => ({ ...p, memberId: e.target.value }))} style={{ ...input, fontSize: '0.95rem' }}>
              <option value="">— choose a brother —</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.name} ({m.degree}){m.email ? '' : ' — no email on file'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['task', 'plan'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setForm(p => ({ ...p, mode }))}
                aria-pressed={form.mode === mode}
                style={{
                  background: form.mode === mode ? 'rgba(201,168,76,0.15)' : 'transparent',
                  border: `1px solid ${form.mode === mode ? 'rgba(201,168,76,0.5)' : 'rgba(201,168,76,0.18)'}`,
                  color: form.mode === mode ? '#F5F0E8' : '#B8B0A0',
                  fontFamily: 'Cinzel, serif', fontSize: '0.72rem',
                  padding: '8px 14px', borderRadius: 3, cursor: 'pointer',
                }}
              >
                {mode === 'task' ? 'A single task' : 'A whole degree plan'}
              </button>
            ))}
          </div>

          {form.mode === 'plan' ? (
            <div>
              {label('WHICH DEGREE')}
              <select value={form.degree} onChange={(e) => setForm(p => ({ ...p, degree: e.target.value }))} style={{ ...input, fontSize: '0.95rem' }}>
                {/* Only degrees with a curriculum written. Seventeen
                    options of which fifteen are disabled is a list that
                    reads as broken. */}
                {CURRICULUM_DEGREES.filter((d) => curriculumCounts[d]).map((d) => (
                  <option key={d} value={d}>
                    {DEGREE_TITLE[d]} — {curriculumCounts[d]} steps
                  </option>
                ))}
              </select>
              <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.85rem', color: '#918879', margin: '6px 0 0' }}>
                Every step of that degree, in order. Steps he already has are skipped, so running
                this again after adding new ones gives him only the new ones. He receives{' '}
                <strong>one</strong> email listing them, not one per step.
              </p>
            </div>
          ) : (
            <>
              <div>{label('WHAT')}<input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Look into the roof quotes" style={input} /></div>
              <div>{label('ANY DETAIL')}<input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional" style={input} /></div>
              {documents.length > 0 && (
                <div>
                  {label('MATERIAL')}
                  <select value={form.documentId} onChange={(e) => setForm(p => ({ ...p, documentId: e.target.value }))} style={{ ...input, fontSize: '0.9rem' }}>
                    <option value="">— none —</option>
                    {documents.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </>
          )}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              {label('BY WHEN (OPTIONAL)')}
              <input type="date" value={form.dueDate} onChange={(e) => setForm(p => ({ ...p, dueDate: e.target.value }))}
                style={{ ...input, width: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }} />
            </div>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer', paddingBottom: 9 }}>
              <input type="checkbox" checked={form.notify} onChange={(e) => setForm(p => ({ ...p, notify: e.target.checked }))} style={{ accentColor: '#C9A84C' }} />
              <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', color: '#F5F0E8' }}>Email him</span>
            </label>
          </div>

          {chosen && !chosen.email && form.notify && (
            <div style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.88rem', color: '#C9A84C' }}>
              {chosen.name} has no email address on file — he will see this in the portal, but he
              will not be told.
            </div>
          )}

          {error && <div style={{ color: '#EC5B4B', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>{error}</div>}
          {notice && <div style={{ color: '#5DBE85', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>{notice}</div>}

          <div>
            <button onClick={assign} disabled={busy} className="btn-gold" style={{ fontSize: '0.68rem', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Assigning…' : form.mode === 'plan' ? 'Assign the plan' : 'Assign the task'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ borderBottom: '1px solid rgba(201,168,76,0.12)', margin: '1.6rem 0 1.2rem', display: 'flex', flexWrap: 'wrap' }}>
        {(['awaiting', 'open', 'done'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
            style={{
              background: 'none', border: 'none',
              borderBottom: `2px solid ${tab === t ? '#C9A84C' : 'transparent'}`,
              color: tab === t ? '#F5F0E8' : '#B8B0A0',
              fontFamily: 'Cinzel, serif', fontSize: '0.85rem',
              padding: '10px 4px', marginRight: '1.6rem', cursor: 'pointer',
            }}>
            {t === 'awaiting' ? 'Awaiting You' : t === 'open' ? 'Outstanding' : 'Completed'}
            {t === 'awaiting' && awaitingCount > 0 && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#C9A84C', marginLeft: 6 }}>
                {awaitingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="data-box">
        {rows.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontFamily: 'Crimson Pro, serif' }}>
            {tab === 'open' ? 'Nothing outstanding.' : 'Nothing completed yet.'}
          </div>
        ) : rows.map(({ a, status }) => (
          <div key={a.id} style={{ padding: '0.9rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* THE WHOLE ROW OPENS THE BROTHER IT WAS GIVEN TO.
                Nothing here was clickable before, so an officer wanting
                to see how a man was getting on had no way in from the
                list — and the only link anywhere near this feature was
                the email's, which goes to the reader's OWN portal. That
                is why opening a task landed you on your own account. */}
            <Link
              href={`/lodge/${slug}/members/${a.assigned_to}?tab=Tasks`}
              style={{ flex: 1, minWidth: 200, textDecoration: 'none' }}
            >
              <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.88rem', color: '#F5F0E8' }}>{a.title}</div>
              <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: '#C9A84C' }}>
                {nameOf(a.assigned_to)} →
                <span style={{ color: '#B8B0A0' }}>
                  {a.assigned_by_name ? ` · asked by ${a.assigned_by_name}` : ''}
                  {dueLabel(a.due_date) ? ` · ${dueLabel(a.due_date)}` : ''}
                </span>
              </div>
              {a.step_id && (
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', color: '#918879', marginTop: 3 }}>
                  DEGREE WORK · SIGNED OFF ON THE DEGREES PAGE
                </div>
              )}
            </Link>
            <span className={`pill ${statusPill(status)}`}>{statusLabel(status)}</span>
            {status === 'awaiting' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => act(a.id, { action: 'signoff' })} disabled={busy}
                  style={{ background: 'rgba(39,174,96,0.14)', border: '1px solid rgba(39,174,96,0.45)', color: '#5DBE85', cursor: 'pointer', borderRadius: 3, padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.1em' }}>
                  SIGN OFF
                </button>
                <button onClick={() => { setDeclining(a.id); setDeclineNote('') }} disabled={busy}
                  style={{ background: 'transparent', border: '1px solid rgba(231,76,60,0.35)', color: '#EC5B4B', cursor: 'pointer', borderRadius: 3, padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.1em' }}>
                  SEND BACK
                </button>
              </div>
            )}

            {declining === a.id && (
              <div style={{ width: '100%', marginTop: 8 }}>
                <input
                  value={declineNote}
                  onChange={(e) => setDeclineNote(e.target.value)}
                  placeholder="What is still wanting? He is emailed this."
                  style={{ ...input, marginBottom: 6 }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={async () => { await act(a.id, { action: 'decline', note: declineNote }); setDeclining(null) }}
                    disabled={busy}
                    style={{ background: 'rgba(231,76,60,0.14)', border: '1px solid rgba(231,76,60,0.45)', color: '#EC5B4B', cursor: 'pointer', borderRadius: 3, padding: '7px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem', letterSpacing: '0.1em' }}>
                    SEND IT BACK
                  </button>
                  <button onClick={() => setDeclining(null)} disabled={busy}
                    style={{ background: 'transparent', border: '1px solid rgba(184,176,160,0.25)', color: '#B8B0A0', cursor: 'pointer', borderRadius: 3, padding: '7px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem' }}>
                    CANCEL
                  </button>
                </div>
                <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.82rem', color: '#918879', margin: '6px 0 0' }}>
                  A proficiency returned without a reason teaches nothing except that he failed.
                </p>
              </div>
            )}

            {(status === 'open' || status === 'overdue' || status === 'declined') && (
              <button onClick={() => act(a.id, { action: 'cancel' })} disabled={busy}
                style={{ background: 'none', border: '1px solid rgba(184,176,160,0.25)', color: '#918879', cursor: 'pointer', borderRadius: 3, padding: '5px 9px', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em' }}>
                WITHDRAW
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
