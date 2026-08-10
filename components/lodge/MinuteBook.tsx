'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { peekStagedMinutes, discardStagedMinutes } from '@/lib/minutesHandoff'
import { callApi, errorMessage } from '@/lib/clientFetch'

/**
 * The minute book.
 *
 * Before this the lodge's principal record lived in a word processor
 * file on one man's laptop — unsearchable by anyone else, and gone when
 * he handed over the office.
 *
 * THE APPROVAL IS THE POINT, not the storage. Minutes are read at the
 * NEXT stated communication and approved, or approved as corrected;
 * until then they are one officer's account carrying no authority. The
 * book shows which state each set is in, and approval records the date
 * and the meeting at which the lodge did it.
 *
 * SEARCH IS THE OTHER POINT. "When did we vote on the roof?" is the
 * question a minute book exists to answer and the one thing a stack of
 * documents cannot do. Filtering happens here, over the sets already
 * loaded, because a lodge has a few dozen meetings a year — a round
 * trip per keystroke would be slower and worse.
 */

const STATUS_PILL: Record<string, string> = {
  draft: 'pill-excused',
  submitted: 'pill-new',
  approved: 'pill-active',
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'To be read',
  approved: 'Approved',
}

type Minutes = {
  id: string
  event_id: string
  body: string
  status: string
  approved_on: string | null
  approved_by_name: string | null
  correction_note: string | null
  drafted_by_name: string | null
  lodge_events: { id: string; title: string; event_date: string } | null
}

export function MinuteBook({
  slug,
  tenantId,
  minutes,
  meetingsWithoutMinutes,
  canApprove,
}: {
  slug: string
  tenantId: string
  minutes: Minutes[]
  meetingsWithoutMinutes: { id: string; title: string; event_date: string }[]
  canApprove: boolean
}) {
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [approving, setApproving] = useState<Minutes | null>(null)
  const [approvalEvent, setApprovalEvent] = useState('')
  const [approvalDate, setApprovalDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [correction, setCorrection] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState(minutes)
  // A draft the AI Secretary handed over. Peeked, not taken — the
  // editor is what consumes it, once the officer has said which meeting
  // it belongs to.
  const [waitingDraft, setWaitingDraft] = useState<string | null>(null)

  useEffect(() => { setWaitingDraft(peekStagedMinutes()) }, [])

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(
      (m) =>
        m.body.toLowerCase().includes(needle) ||
        (m.lodge_events?.title ?? '').toLowerCase().includes(needle) ||
        (m.lodge_events?.event_date ?? '').includes(needle)
    )
  }, [rows, query])

  const approve = async () => {
    if (!approving) return
    setBusy(true)
    setError('')
    try {
      const data = await callApi('/api/minutes', {
        method: 'PUT',
        body: {
          tenantId,
          minutesId: approving.id,
          approvedAtEventId: approvalEvent || null,
          approvedOn: approvalDate,
          correctionNote: correction,
        },
      })
      setRows((prev) => prev.map((m) => (m.id === approving.id ? { ...m, ...data.minutes } : m)))
      setApproving(null)
      setCorrection('')
      setApprovalEvent('')
    } catch (e) {
      setError(errorMessage(e, 'Could not record the approval.'))
    } finally {
      setBusy(false)
    }
  }

  /**
   * A meeting the lodge could approve these AT — anything but the
   * meeting they record, since minutes are written afterwards and read
   * at the next one. The server refuses the circular case too; this
   * just keeps it out of the list.
   */
  const approvalCandidates = (forMinutes: Minutes | null) =>
    forMinutes
      ? rows
          .map((m) => m.lodge_events)
          .concat(meetingsWithoutMinutes)
          .filter((e): e is NonNullable<typeof e> => !!e && e.id !== forMinutes.event_id)
          .filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i)
          .sort((a, b) => b.event_date.localeCompare(a.event_date))
      : []

  return (
    <div>
      {/* A DRAFT LOOKING FOR ITS MEETING.
          The assistant drafts from the record without necessarily
          naming which meeting, so the officer chooses here — where the
          meetings are listed with their dates — rather than the app
          guessing and filing minutes against the wrong evening. */}
      {waitingDraft && (
        <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)', padding: '1rem 1.4rem', marginBottom: '1.2rem', borderRadius: 4 }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.14em', color: '#C9A84C', marginBottom: 6 }}>
            A DRAFT IS WAITING
          </div>
          <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#E8E2D5', marginBottom: 10 }}>
            The AI Secretary has {waitingDraft.length.toLocaleString()} characters of minutes ready.
            Open the meeting they belong to and they will be waiting in the editor.
          </div>
          <button
            onClick={() => { discardStagedMinutes(); setWaitingDraft(null) }}
            style={{ background: 'transparent', border: '1px solid rgba(184,176,160,0.25)', color: '#B8B0A0', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.12em', padding: '6px 10px', borderRadius: 3, cursor: 'pointer' }}
          >
            DISCARD IT
          </button>
        </div>
      )}

      {/* MEETINGS WITH NOTHING WRITTEN.
          The gap is the useful view: a minute book tells you what was
          recorded, and what an officer needs to know is which meeting
          has not been. */}
      {meetingsWithoutMinutes.length > 0 && (
        <div className="data-box">
          <div className="data-box-head">
            <span>Awaiting Minutes</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>
              {meetingsWithoutMinutes.length}
            </span>
          </div>
          {meetingsWithoutMinutes.map((e) => (
            <div
              key={e.id}
              style={{ padding: '0.85rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}
            >
              <span>
                <span style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.88rem', color: '#F5F0E8' }}>{e.title}</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>{e.event_date}</span>
              </span>
              <Link
                href={`/lodge/${slug}/minutes/${e.id}`}
                className="btn-gold"
                style={{ fontSize: '0.62rem', padding: '7px 14px', textDecoration: 'none' }}
              >
                Write Minutes
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="data-box">
        <div className="data-box-head">
          <span>The Minute Book</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#B8B0A0' }}>{rows.length}</span>
        </div>

        <div style={{ padding: '1rem 1.4rem', borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the minutes — a name, a motion, a date…"
            style={{
              width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)',
              color: '#F5F0E8', padding: '10px 12px', borderRadius: 4,
              fontFamily: 'Crimson Pro, serif', fontSize: '16px',
            }}
          />
          {query.trim() && (
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0', marginTop: 6 }}>
              {results.length} of {rows.length} {results.length === 1 ? 'set' : 'sets'} mention it
            </div>
          )}
        </div>

        {results.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#B8B0A0', fontStyle: 'italic', fontFamily: 'Crimson Pro, serif' }}>
            {rows.length === 0
              ? 'No minutes recorded yet. Write the first set from a meeting above — the AI Secretary can draft them from the agenda and roll already recorded that evening.'
              : 'Nothing in the book mentions that.'}
          </div>
        ) : (
          results.map((m) => {
            const open = openId === m.id
            const event = m.lodge_events
            return (
              <div key={m.id} style={{ borderBottom: '1px solid rgba(201,168,76,0.05)' }}>
                <div style={{ padding: '0.9rem 1.4rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setOpenId(open ? null : m.id)}
                    aria-expanded={open}
                    style={{ background: 'none', border: 'none', color: '#F5F0E8', cursor: 'pointer', textAlign: 'left', flex: 1, minWidth: 200, padding: 0 }}
                  >
                    <span style={{ display: 'block', fontFamily: 'Cinzel, serif', fontSize: '0.92rem' }}>
                      {event?.title ?? 'Meeting'}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#B8B0A0' }}>
                      {event?.event_date}
                      {m.approved_on ? ` · approved ${m.approved_on}` : ''}
                      {m.approved_by_name ? ` · ${m.approved_by_name}` : ''}
                    </span>
                  </button>

                  <span className={`pill ${STATUS_PILL[m.status] ?? 'pill-new'}`}>
                    {STATUS_LABEL[m.status] ?? m.status}
                  </span>

                  {m.status !== 'approved' && (
                    <Link
                      href={`/lodge/${slug}/minutes/${m.event_id}`}
                      style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.1em', color: '#C9A84C', textDecoration: 'none' }}
                    >
                      EDIT
                    </Link>
                  )}

                  {canApprove && m.status !== 'approved' && m.body.trim() && (
                    <button
                      onClick={() => { setError(''); setApproving(m); setApprovalEvent('') }}
                      style={{
                        background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.4)',
                        color: '#C9A84C', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.56rem',
                        letterSpacing: '0.12em', padding: '6px 10px', borderRadius: 3, cursor: 'pointer',
                      }}
                    >
                      RECORD APPROVAL
                    </button>
                  )}
                </div>

                {open && (
                  <div style={{ padding: '0 1.4rem 1.2rem' }}>
                    {m.correction_note && (
                      <div style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)', padding: '10px 12px', borderRadius: 4, marginBottom: '0.9rem' }}>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.14em', color: '#C9A84C', marginBottom: 4 }}>
                          APPROVED AS CORRECTED
                        </div>
                        <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem', color: '#E8E2D5' }}>
                          {m.correction_note}
                        </div>
                      </div>
                    )}
                    <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', lineHeight: 1.7, color: '#E8E2D5', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {m.body || <span style={{ fontStyle: 'italic', color: '#918879' }}>Nothing written yet.</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* RECORDING THE APPROVAL.
          Not a checkbox: the lodge approved these on a date, at a
          meeting, possibly with a correction, and all three are the
          record. */}
      {approving && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' }}
          onClick={() => { if (!busy) setApproving(null) }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#141C2E', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 6, padding: '1.5rem', maxWidth: 520, width: '100%', maxHeight: '90dvh', overflowY: 'auto' }}
          >
            <h2 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: '#F5F0E8', margin: '0 0 0.6rem' }}>
              Record the lodge&apos;s approval
            </h2>
            <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#B8B0A0', margin: '0 0 1.2rem' }}>
              The minutes of <strong style={{ color: '#F5F0E8' }}>{approving.lodge_events?.title}</strong> were
              read and approved. Once recorded they become the lodge&apos;s record and can no longer
              be edited — a later correction is itself an act of the lodge at a meeting.
            </p>

            <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0', marginBottom: 4 }}>
              READ AND APPROVED AT
            </label>
            <select
              value={approvalEvent}
              onChange={(e) => setApprovalEvent(e.target.value)}
              style={{ width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '9px 11px', borderRadius: 4, fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', marginBottom: '0.9rem' }}
            >
              <option value="">— which meeting —</option>
              {approvalCandidates(approving).map((e) => (
                <option key={e.id} value={e.id}>{e.event_date} · {e.title}</option>
              ))}
            </select>

            <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0', marginBottom: 4 }}>
              DATE OF APPROVAL
            </label>
            <input
              type="date"
              value={approvalDate}
              onChange={(e) => setApprovalDate(e.target.value)}
              style={{ background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '9px 11px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', marginBottom: '0.9rem' }}
            />

            <label style={{ display: 'block', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0', marginBottom: 4 }}>
              CORRECTION, IF APPROVED AS CORRECTED
            </label>
            <textarea
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              rows={3}
              placeholder="Leave empty if approved as read."
              style={{ width: '100%', background: '#0A0E1A', border: '1px solid rgba(201,168,76,0.2)', color: '#F5F0E8', padding: '9px 11px', borderRadius: 4, fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', resize: 'vertical' }}
            />

            {error && (
              <div style={{ marginTop: '0.8rem', color: '#EC5B4B', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>{error}</div>
            )}

            <div style={{ display: 'flex', gap: '0.7rem', marginTop: '1.2rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setApproving(null)}
                disabled={busy}
                style={{ background: 'transparent', border: '1px solid rgba(184,176,160,0.25)', color: '#B8B0A0', padding: '9px 18px', borderRadius: 4, cursor: 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.75rem' }}
              >
                Cancel
              </button>
              <button onClick={approve} disabled={busy} className="btn-gold" style={{ fontSize: '0.7rem', opacity: busy ? 0.6 : 1 }}>
                {busy ? 'Recording…' : 'Record Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
