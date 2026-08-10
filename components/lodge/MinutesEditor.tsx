'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { takeStagedMinutes } from '@/lib/minutesHandoff'
import { callApi, errorMessage } from '@/lib/clientFetch'

/**
 * Writing up a meeting.
 *
 * The evening's record is already in the app — the agenda as it was
 * worked through, who answered the roll, which visiting brethren
 * signed. What was missing was anywhere to put the prose, so it went
 * into a word processor and out of the lodge's reach.
 *
 * The AI Secretary drafts from that same record (get_meeting_record),
 * and its draft arrives here through sessionStorage rather than a query
 * string, because a set of minutes runs to hundreds of words and URL
 * limits vary by browser and proxy.
 */
export function MinutesEditor({
  tenantId,
  eventId,
  slug,
  event,
  initial,
  attendanceSummary,
  visitors,
}: {
  tenantId: string
  eventId: string
  slug: string
  event: { title: string; event_date: string }
  initial: { id: string; body: string; status: string } | null
  attendanceSummary: { present: number; absent: number; excused: number }
  visitors: { name: string; visiting_from: string | null }[]
}) {
  const router = useRouter()
  const [body, setBody] = useState(initial?.body ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'draft')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [fromAssistant, setFromAssistant] = useState(false)

  /**
   * A draft handed over by the AI Secretary.
   *
   * Read once and cleared, so returning to this page later does not
   * resurrect a draft that was already saved or abandoned. It replaces
   * the box only when the box is empty or the officer confirms —
   * silently overwriting minutes someone has been typing would be the
   * worst thing this feature could do.
   */
  useEffect(() => {
    const staged = takeStagedMinutes()
    if (!staged) return
    setBody((current) => {
      if (!current.trim()) {
        setFromAssistant(true)
        return staged
      }
      const replace = window.confirm(
        'The AI Secretary has a draft ready, but there is already text here. Replace what you have written?'
      )
      if (replace) setFromAssistant(true)
      return replace ? staged : current
    })
  }, [])

  const save = async (nextStatus: 'draft' | 'submitted') => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const data = await callApi('/api/minutes', {
        body: { tenantId, eventId, body, status: nextStatus },
      })
      setStatus(data.minutes.status)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      if (nextStatus === 'submitted') router.push(`/lodge/${slug}/minutes`)
    } catch (e) {
      setError(errorMessage(e, 'Could not save the minutes.'))
    } finally {
      setSaving(false)
    }
  }

  const locked = status === 'approved'

  return (
    <div>
      {/* WHAT THE LODGE ALREADY RECORDED THAT EVENING.
          Shown beside the box because these are the facts a set of
          minutes has to state, and having them on screen is what stops
          the Secretary writing "about a dozen present". */}
      <div className="data-box" style={{ marginBottom: '1.2rem' }}>
        <div className="data-box-head">
          <span>What was recorded on the night</span>
        </div>
        <div style={{ padding: '1rem 1.4rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0' }}>ROLL</div>
            <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#E8E2D5' }}>
              {attendanceSummary.present} present · {attendanceSummary.absent} absent ·{' '}
              {attendanceSummary.excused} excused
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.1em', color: '#B8B0A0' }}>VISITING BRETHREN</div>
            <div style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: '#E8E2D5' }}>
              {visitors.length === 0
                ? 'None recorded'
                : visitors.map((v) => `${v.name}${v.visiting_from ? ` (${v.visiting_from})` : ''}`).join(', ')}
            </div>
          </div>
        </div>
        <div style={{ padding: '0 1.4rem 1rem', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', fontSize: '0.88rem', color: '#918879' }}>
          Ask the AI Secretary to &ldquo;draft the minutes for {event.title}&rdquo; and it will build
          them from this record and the agenda, then hand the draft straight to this page.
        </div>
      </div>

      {fromAssistant && (
        <div style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', padding: '10px 14px', borderRadius: 4, marginBottom: '1rem', fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem', color: '#E8E2D5' }}>
          This draft came from the AI Secretary. Read it against your own notes before submitting it
          — it is a draft, and the lodge approves what you sign.
        </div>
      )}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={locked}
        rows={24}
        placeholder="The lodge was opened in due form at…"
        style={{
          width: '100%',
          background: '#0A0E1A',
          border: '1px solid rgba(201,168,76,0.2)',
          color: '#F5F0E8',
          padding: '16px',
          borderRadius: 4,
          fontFamily: 'Crimson Pro, serif',
          fontSize: '16px',
          lineHeight: 1.7,
          resize: 'vertical',
          opacity: locked ? 0.7 : 1,
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.8rem' }}>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#918879' }}>
          {body.length.toLocaleString()} characters
          {saved && <span style={{ color: '#5DBE85', marginLeft: 12 }}>✓ SAVED</span>}
        </span>

        {!locked && (
          <div style={{ display: 'flex', gap: '0.7rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => save('draft')}
              disabled={saving}
              style={{ background: 'transparent', border: '1px solid rgba(201,168,76,0.3)', color: '#C9A84C', padding: '9px 18px', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Cinzel, serif', fontSize: '0.75rem' }}
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => save('submitted')}
              disabled={saving || !body.trim()}
              className="btn-gold"
              style={{ fontSize: '0.72rem', opacity: saving || !body.trim() ? 0.5 : 1 }}
            >
              Submit to be Read
            </button>
          </div>
        )}
      </div>

      {locked && (
        <div style={{ marginTop: '0.9rem', fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: '#918879' }}>
          These minutes have been read and approved by the lodge. They are the lodge&apos;s record
          now and cannot be edited — a correction is made at a meeting and recorded against the
          approval.
        </div>
      )}

      {error && (
        <div style={{ marginTop: '0.9rem', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', color: '#EC5B4B', padding: '9px 12px', borderRadius: 4, fontFamily: 'Crimson Pro, serif', fontSize: '0.92rem' }}>
          {error}
        </div>
      )}
    </div>
  )
}
