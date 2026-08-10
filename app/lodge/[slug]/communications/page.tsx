'use client'
import { Fragment, useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { T } from '@/lib/designTokens'
import { ConfirmDialog } from '@/components/lodge/ConfirmDialog'
import { upcomingSince } from '@/lib/dates'

/**
 * Communications.
 *
 * The compose form previously offered no way to answer the questions an
 * officer actually has before sending to the whole lodge: how many
 * people is this going to, who exactly, what will it look like, and did
 * the last one arrive. Sending was a one-way door with no preview, no
 * test, and a history that recorded only that *something* was sent.
 *
 * What's here now:
 * - a live recipient count and the actual roster behind it, including
 *   who will be MISSED for want of an email address
 * - a rendered preview of the email itself
 * - a test send to yourself, which is recorded nowhere
 * - drafts, using the is_draft column that already existed but was
 *   never written to
 * - history showing delivery outcome per notice, with the addresses
 *   that failed and why
 */

const GROUP_LABELS: Record<string, string> = {
  all: 'All Brothers',
  mm_only: 'Master Masons Only',
  candidates: 'Candidates (EA & FC)',
  dues_outstanding: 'Dues Outstanding',
}

type Member = {
  degree: string
  dues_status: string
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null
}

/**
 * A sensible default when switching to scheduled send: one hour out,
 * formatted for datetime-local, which expects LOCAL time with no zone
 * suffix. Building it from toISOString() would silently offset the
 * default by the browser's UTC difference — the value is converted back
 * to a real instant with new Date() at submit time, where the browser's
 * zone is applied correctly.
 */
function defaultScheduleValue(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function LodgeCommunicationsPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [tenant, setTenant] = useState<any>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [comms, setComms] = useState<any[]>([])
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({ subject: '', body: '', recipient_group: 'all' })
  const [scheduleAt, setScheduleAt] = useState('')
  const [eventId, setEventId] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [events, setEvents] = useState<any[]>([])
  const [draftId, setDraftId] = useState<string | null>(null)

  const [busy, setBusy] = useState<'' | 'send' | 'test' | 'draft'>('')
  const [notice, setNotice] = useState('')
  const [sendError, setSendError] = useState('')
  const [failedList, setFailedList] = useState<{ email: string; reason: string }[]>([])
  const [showRecipients, setShowRecipients] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deliveryProblems, setDeliveryProblems] = useState<any[]>([])
  const [recipientDetail, setRecipientDetail] = useState<Record<string, any[]>>({})

  const load = async () => {
    const { data: t } = await supabase.from('tenants').select('id, name, number').eq('slug', slug).single()
    if (!t) { setLoading(false); return }
    setTenant(t)

    const today = upcomingSince()
    const [{ data: m }, { data: c }, { data: problems }, { data: ev }] = await Promise.all([
      supabase
        .from('tenant_members')
        .select('degree, dues_status, profiles(first_name, last_name, email)')
        .eq('tenant_id', t.id)
        .eq('is_active', true),
      supabase
        .from('communications')
        .select('*, profiles(first_name, last_name)')
        .eq('tenant_id', t.id)
        .order('created_at', { ascending: false }),
      // Addresses that have hard-bounced or complained on ANY notice.
      // This is the standing problem list — a bounced address means that
      // brother has silently stopped receiving everything the lodge
      // sends, and nobody finds out unless it's surfaced.
      supabase
        .from('communication_recipients')
        .select('email, status, detail, last_event_at')
        .eq('tenant_id', t.id)
        .in('status', ['bounced', 'complained'])
        .order('last_event_at', { ascending: false }),
      // Upcoming only — attaching a notice to a meeting that already
      // happened is almost always a mis-click.
      supabase
        .from('lodge_events')
        .select('id, title, event_date, event_time, location')
        .eq('tenant_id', t.id)
        .gte('event_date', today)
        .order('event_date')
        .limit(25),
    ])

    setEvents(ev ?? [])
    setMembers((m ?? []) as any)
    setComms((c ?? []).filter((x: any) => !x.is_draft))
    setDrafts((c ?? []).filter((x: any) => x.is_draft))

    // One entry per address, keeping the most recent event.
    const byEmail = new Map<string, any>()
    for (const p of problems ?? []) {
      if (!byEmail.has((p as any).email)) byEmail.set((p as any).email, p)
    }
    setDeliveryProblems(Array.from(byEmail.values()))

    setLoading(false)
  }

  const loadRecipients = async (communicationId: string) => {
    const { data } = await supabase
      .from('communication_recipients')
      .select('email, status, detail')
      .eq('communication_id', communicationId)
      .order('status')
    setRecipientDetail((prev) => ({ ...prev, [communicationId]: data ?? [] }))
  }

  useEffect(() => { load() }, [])

  /**
   * The same filter the server applies, mirrored here so the count is
   * live as the group changes rather than a surprise after sending.
   * The server remains the authority — this is a preview, and it reads
   * only rows RLS already allows this officer to see.
   */
  const targeted = useMemo(() => {
    const g = form.recipient_group
    return members.filter((m) => {
      if (g === 'mm_only') return m.degree === 'MM'
      if (g === 'candidates') return m.degree === 'EA' || m.degree === 'FC'
      if (g === 'dues_outstanding') return m.dues_status === 'due'
      return true
    })
  }, [members, form.recipient_group])

  const reachable = targeted.filter((m) => m.profiles?.email)
  const unreachable = targeted.filter((m) => !m.profiles?.email)

  const canCompose = form.subject.trim().length > 0 && form.body.trim().length > 0

  const post = async (mode: 'send' | 'test' | 'draft') => {
    setBusy(mode)
    setSendError('')
    setNotice('')
    setFailedList([])

    try {
      const res = await fetch('/api/communications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          subject: form.subject,
          body: form.body,
          recipientGroup: form.recipient_group,
          mode,
          draftId,
          // Only meaningful for a real send; a test goes now.
          scheduledAt: mode === 'send' && scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
          eventId: eventId || undefined,
          meetingUrl: meetingUrl.trim() || undefined,
        }),
      })
      const result = await res.json()

      if (!res.ok || (mode === 'send' && !result.success)) {
        setSendError(result.error || 'The notice could not be sent.')
        if (result.failedRecipients) setFailedList(result.failedRecipients)
        return
      }

      if (mode === 'test') {
        setNotice(`Test sent to ${result.sentTo}. Check your inbox before sending to the lodge.`)
        return
      }

      if (mode === 'draft') {
        setNotice('Draft saved.')
        setDraftId(result.communication?.id ?? draftId)
        await load()
        return
      }

      setNotice(
        result.scheduledFor
          ? `Scheduled for ${new Date(result.scheduledFor).toLocaleString()} — ${result.sent} ${result.sent === 1 ? 'brother' : 'brothers'} queued.`
          : `Sent to ${result.sent} of ${result.total} ${result.total === 1 ? 'brother' : 'brothers'}.` +
            (result.warning ? ` ${result.warning}` : '')
      )
      if (result.failedRecipients?.length) setFailedList(result.failedRecipients)
      setForm({ subject: '', body: '', recipient_group: 'all' })
      setScheduleAt('')
      setEventId('')
      setMeetingUrl('')
      setDraftId(null)
      await load()
    } catch (err: any) {
      setSendError(err?.message || 'The notice could not be sent.')
    } finally {
      setBusy('')
      setConfirmOpen(false)
    }
  }

  const loadDraft = (d: any) => {
    setForm({ subject: d.subject, body: d.body, recipient_group: d.recipient_group })
    setDraftId(d.id)
    setNotice('Draft loaded — edit and send when ready.')
    setSendError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const discardDraft = async (id: string) => {
    await supabase.from('communications').delete().eq('id', id)
    if (draftId === id) setDraftId(null)
    await load()
  }

  const inputStyle = {
    width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink,
    padding: '10px 14px', fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem',
    outline: 'none', borderRadius: '4px', boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.2em',
    color: T.gold, textTransform: 'uppercase' as const, marginBottom: '6px', display: 'block',
  }
  const ghostButton = {
    fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.1em',
    background: 'transparent', border: `1px solid ${T.goldBorder}`, color: T.gold,
    padding: '9px 16px', borderRadius: '4px', cursor: 'pointer', textTransform: 'uppercase' as const,
  }

  if (loading) return <div style={{ padding: '2rem', color: T.inkFaint, fontStyle: 'italic' }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'Cinzel, serif', fontSize: '1.4rem', color: T.ink, marginBottom: '0.25rem' }}>Communications</h1>
        <p style={{ fontFamily: 'Crimson Pro, serif', fontStyle: 'italic', color: T.inkFaint }}>
          Send notices to the brethren — replies come back to you, not to a noreply address
        </p>
      </div>

      {/* The standing problem list. A hard bounce is invisible to
          everyone — including the brother, who simply stops hearing from
          the lodge — unless someone is shown it. */}
      {deliveryProblems.length > 0 && (
        <div className="data-box" style={{ padding: '1.25rem 1.4rem', borderColor: 'rgba(231,76,60,0.3)' }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.15em', color: T.danger, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Not Reaching {deliveryProblems.length} {deliveryProblems.length === 1 ? 'Brother' : 'Brothers'}
          </div>
          <p style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, marginTop: 0, marginBottom: '0.9rem', lineHeight: 1.7 }}>
            These addresses permanently failed or marked lodge mail as spam. They are not receiving
            anything the lodge sends. Correcting them on the roster is the fix — continuing to send to a
            bounced address also damages the sending reputation for every other brother.
          </p>
          {deliveryProblems.map((p, i) => {
            const member = members.find((m) => m.profiles?.email?.toLowerCase() === p.email)
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '4px 0', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem' }}>
                <span style={{ color: T.ink }}>
                  {member ? `Bro. ${member.profiles?.first_name} ${member.profiles?.last_name}` : p.email}
                  {member && <span style={{ color: T.inkFainter, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem' }}> · {p.email}</span>}
                </span>
                <span style={{ color: T.danger, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem' }}>
                  {p.status === 'complained' ? 'MARKED AS SPAM' : 'BOUNCED'}
                  {p.detail ? ` — ${p.detail}` : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {drafts.length > 0 && (
        <div className="data-box" style={{ padding: '1rem 1.4rem' }}>
          <div style={{ ...labelStyle, marginBottom: '0.75rem' }}>Drafts ({drafts.length})</div>
          {drafts.map((d) => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.5rem 0', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Cinzel, serif', fontSize: '0.85rem', color: T.ink }}>{d.subject}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: T.inkFainter }}>
                  {format(new Date(d.created_at), 'MMM d, yyyy')} · {GROUP_LABELS[d.recipient_group] ?? d.recipient_group}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => loadDraft(d)} style={ghostButton}>Resume</button>
                <button
                  onClick={() => discardDraft(d.id)}
                  style={{ ...ghostButton, borderColor: 'rgba(231,76,60,0.25)', color: T.danger }}
                >
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="data-box" style={{ padding: '2rem' }}>
        <div style={{ fontFamily: 'Cinzel, serif', fontSize: '1.1rem', color: T.gold, marginBottom: '1.5rem' }}>
          ✉ Compose Notice {draftId && <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: T.inkFaint }}>· editing draft</span>}
        </div>

        {notice && (
          <div style={{ background: T.successDim, border: '1px solid rgba(93,190,133,0.3)', color: T.success, padding: '10px 14px', borderRadius: '4px', marginBottom: '1rem', fontFamily: 'Crimson Pro, serif' }}>
            ✓ {notice}
          </div>
        )}
        {sendError && (
          <div style={{ background: T.dangerDim, border: '1px solid rgba(231,76,60,0.3)', color: T.danger, padding: '10px 14px', borderRadius: '4px', marginBottom: '1rem', fontFamily: 'Crimson Pro, serif' }}>
            {sendError}
          </div>
        )}
        {failedList.length > 0 && (
          <div style={{ background: 'rgba(231,76,60,0.06)', border: '1px solid rgba(231,76,60,0.2)', padding: '10px 14px', borderRadius: '4px', marginBottom: '1rem' }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: T.danger, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
              NOT REACHED ({failedList.length})
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontFamily: 'Crimson Pro, serif', fontSize: '0.88rem', color: T.inkFaint, lineHeight: 1.7, maxHeight: 160, overflowY: 'auto' }}>
              {failedList.map((f, i) => <li key={i}>{f.email} — {f.reason}</li>)}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
              <label style={labelStyle}>Subject</label>
              <input
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="e.g. Reminder — Stated Communication this Tuesday"
                maxLength={200}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Send To</label>
              <select
                value={form.recipient_group}
                onChange={e => setForm(p => ({ ...p, recipient_group: e.target.value }))}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {Object.entries(GROUP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* The count an officer needs before committing, not after. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', fontFamily: 'Crimson Pro, serif', color: T.inkFaint }}>
            <span>
              <strong style={{ color: T.ink }}>{reachable.length}</strong>{' '}
              {reachable.length === 1 ? 'brother' : 'brothers'} will receive this
              {unreachable.length > 0 && (
                <span style={{ color: T.danger }}> · {unreachable.length} have no email on file</span>
              )}
            </span>
            {targeted.length > 0 && (
              <button onClick={() => setShowRecipients(v => !v)} style={{ ...ghostButton, padding: '5px 12px' }}>
                {showRecipients ? 'Hide list' : 'Who?'}
              </button>
            )}
          </div>

          {showRecipients && (
            <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4, padding: '1rem', maxHeight: 220, overflowY: 'auto' }}>
              {targeted.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontFamily: 'Crimson Pro, serif', fontSize: '0.9rem', padding: '3px 0', color: m.profiles?.email ? T.inkFaint : T.danger }}>
                  <span>Bro. {m.profiles?.first_name} {m.profiles?.last_name}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
                    {m.profiles?.email || 'no email on file'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label style={labelStyle}>Message</label>
            <textarea
              value={form.body}
              onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
              rows={8}
              maxLength={20000}
              placeholder={'Write your message to the brethren…\n\nBlank lines separate paragraphs.'}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
            />
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: T.inkFainter, marginTop: 4, textAlign: 'right' }}>
              {form.body.length} / 20000
            </div>
          </div>

          {showPreview && canCompose && (
            <div>
              <div style={{ ...labelStyle }}>Preview — as a brother will see it</div>
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ fontFamily: 'Georgia, serif', maxWidth: 600, margin: '0 auto', background: '#0A0E1A', color: '#F5F0E8', padding: 40 }}>
                  <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ fontFamily: 'Arial, sans-serif', fontSize: 24, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.2em' }}>LODGEOS</div>
                  </div>
                  <h2 style={{ fontFamily: 'Arial, sans-serif', fontSize: 20, color: '#F5F0E8', marginBottom: 4 }}>{form.subject}</h2>
                  <p style={{ color: 'rgba(184,176,160,0.6)', fontSize: 12, marginBottom: 24 }}>
                    {tenant?.name} #{tenant?.number}
                  </p>
                  <div style={{ background: '#141C2E', padding: 24, marginBottom: 24, borderLeft: '3px solid #C9A84C', color: '#B8B0A0', fontSize: 14, lineHeight: 1.7 }}>
                    <p style={{ margin: '0 0 14px' }}>Brother {reachable[0]?.profiles?.first_name || 'John'},</p>
                    {form.body.split('\n').filter(l => l.trim()).map((line, i) => (
                      <p key={i} style={{ margin: '0 0 14px' }}>{line.trim()}</p>
                    ))}
                  </div>
                  <div style={{ borderTop: '1px solid rgba(201,168,76,0.2)', marginTop: 32, paddingTop: 16, textAlign: 'center' }}>
                    <p style={{ color: 'rgba(184,176,160,0.4)', fontSize: 11, fontStyle: 'italic' }}>Liberty · Equality · Fraternity</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attach a meeting and/or a join link.
              The calendar entry goes out as an "Add to Calendar" LINK
              rather than an .ics attachment: Resend's batch endpoint
              cannot carry attachments at all, and links survive the
              mail-security filters that routinely strip calendar files. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Attach a meeting (optional)</label>
              <select
                value={eventId}
                onChange={e => setEventId(e.target.value)}
                disabled={events.length === 0}
                style={{ ...inputStyle, cursor: events.length === 0 ? 'not-allowed' : 'pointer', opacity: events.length === 0 ? 0.6 : 1 }}
              >
                <option value="">— None —</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {format(new Date(ev.event_date + 'T12:00:00'), 'MMM d')} — {ev.title}
                  </option>
                ))}
              </select>
              {/* An empty dropdown with no explanation reads as broken.
                  This list is upcoming meetings only, so a lodge whose
                  events are all in the past sees nothing — and has no way
                  to tell that apart from a bug. */}
              {events.length === 0 ? (
                <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.8rem', color: T.gold, margin: '5px 0 0', lineHeight: 1.5 }}>
                  No upcoming meetings on the calendar. Only future events can be attached —{' '}
                  <a href={`/lodge/${slug}/events`} style={{ color: T.gold }}>add one on the Events page</a>{' '}
                  and it will appear here.
                </p>
              ) : (
                <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.8rem', color: T.inkFainter, margin: '5px 0 0' }}>
                  Adds the date, time and location, plus an Add to Calendar button.
                </p>
              )}
            </div>
            <div>
              <label style={labelStyle}>Join link (optional)</label>
              <input
                value={meetingUrl}
                onChange={e => setMeetingUrl(e.target.value)}
                placeholder="https://zoom.us/j/… or a Discord invite"
                style={inputStyle}
              />
              <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.8rem', color: T.inkFainter, margin: '5px 0 0' }}>
                Zoom, Meet, Teams or Discord — paste the link and it becomes a button.
              </p>
            </div>
          </div>

          {/* Scheduling is handled by Resend, which holds the message
              and releases it at this instant — so there is no cron job
              or queue on our side, and delivery tracking works exactly
              the same for a scheduled notice. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Send</label>
            <select
              value={scheduleAt ? 'later' : 'now'}
              onChange={(e) => setScheduleAt(e.target.value === 'now' ? '' : defaultScheduleValue())}
              style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
            >
              <option value="now">Immediately</option>
              <option value="later">At a set time</option>
            </select>
            {scheduleAt && (
              <>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  min={defaultScheduleValue()}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  style={{ ...inputStyle, width: 'auto' }}
                />
                <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: T.inkFainter }}>
                  your local time · up to 30 days ahead
                </span>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canCompose || reachable.length === 0 || busy !== ''}
              className="btn-gold"
              style={{ fontSize: '0.7rem', cursor: !canCompose || reachable.length === 0 ? 'not-allowed' : 'pointer', opacity: !canCompose || reachable.length === 0 ? 0.5 : 1 }}
            >
              {busy === 'send'
                ? (scheduleAt ? 'Scheduling…' : 'Sending…')
                : scheduleAt
                  ? `Schedule for ${reachable.length} ${reachable.length === 1 ? 'Brother' : 'Brothers'}`
                  : `Send to ${reachable.length} ${reachable.length === 1 ? 'Brother' : 'Brothers'}`}
            </button>

            <button onClick={() => setShowPreview(v => !v)} disabled={!canCompose} style={{ ...ghostButton, opacity: canCompose ? 1 : 0.5 }}>
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>

            <button onClick={() => post('test')} disabled={!canCompose || busy !== ''} style={{ ...ghostButton, opacity: canCompose ? 1 : 0.5 }}>
              {busy === 'test' ? 'Sending…' : 'Send Test to Me'}
            </button>

            <button onClick={() => post('draft')} disabled={!canCompose || busy !== ''} style={{ ...ghostButton, opacity: canCompose ? 1 : 0.5 }}>
              {busy === 'draft' ? 'Saving…' : 'Save Draft'}
            </button>
          </div>
        </div>
      </div>

      <div className="data-box">
        <div className="data-box-head">Sent Communications</div>
        {comms.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Date', 'Subject', 'Sent By', 'Recipients', 'Delivered', ''].map((h, i) => <th key={h || `c${i}`} className="dash-th">{h}</th>)}</tr>
            </thead>
            <tbody>
              {comms.map((c: any) => {
                const hasOutcome = c.sent_count !== null && c.sent_count !== undefined
                const partial = hasOutcome && c.failed_count > 0
                return (
                  // Fragment carries the key: a row plus its optional
                  // expanded detail row are two siblings from one item.
                  <Fragment key={c.id}>
                    <tr>
                      <td className="dash-td" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem', color: T.inkFaint, whiteSpace: 'nowrap' }}>
                        {format(new Date(c.created_at), 'MMM d, yyyy')}
                      </td>
                      <td className="dash-td">{c.subject}</td>
                      <td className="dash-td" style={{ color: T.inkFaint, fontSize: '0.85rem' }}>
                        {c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : '—'}
                      </td>
                      <td className="dash-td"><span className="pill pill-ea">{GROUP_LABELS[c.recipient_group] ?? c.recipient_group}</span></td>
                      <td className="dash-td" style={{ whiteSpace: 'nowrap' }}>
                        {hasOutcome ? (
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {/* Accepted by Resend — what sent_count has
                                always meant. */}
                            <span className={`pill ${partial ? 'pill-new' : 'pill-active'}`}>
                              {c.sent_count}/{c.recipient_count || c.sent_count} sent
                            </span>
                            {/* Confirmed arrival, from webhooks. Absent
                                until the endpoint is configured, so it
                                only renders once real events exist. */}
                            {c.delivered_count > 0 && (
                              <span className="pill pill-active">{c.delivered_count} delivered</span>
                            )}
                            {c.opened_count > 0 && (
                              <span className="pill pill-fc">{c.opened_count} opened</span>
                            )}
                            {c.bounced_count > 0 && (
                              <span className="pill" style={{ background: T.dangerDim, color: T.danger, border: '1px solid rgba(231,76,60,0.3)' }}>
                                {c.bounced_count} bounced
                              </span>
                            )}
                            {c.complained_count > 0 && (
                              <span className="pill" style={{ background: T.dangerDim, color: T.danger, border: '1px solid rgba(231,76,60,0.3)' }}>
                                {c.complained_count} spam
                              </span>
                            )}
                          </div>
                        ) : (
                          // Notices sent before migration 011 have no
                          // outcome recorded — say so rather than
                          // rendering a misleading 0.
                          <span style={{ color: T.inkFainter, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>not recorded</span>
                        )}
                      </td>
                      <td className="dash-td" style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            const next = expanded === c.id ? null : c.id
                            setExpanded(next)
                            if (next && !recipientDetail[c.id]) loadRecipients(c.id)
                          }}
                          style={{ ...ghostButton, padding: '4px 10px' }}
                        >
                          {expanded === c.id ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                    {expanded === c.id && (
                      <tr>
                        <td className="dash-td" colSpan={6} style={{ background: T.bg }}>
                          <div style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: c.failed_count > 0 ? '1rem' : 0 }}>
                            {c.body}
                          </div>
                          {c.failed_count > 0 && Array.isArray(c.failed_recipients) && c.failed_recipients.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: T.danger, letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                                NEVER SENT ({c.failed_recipients.length})
                              </div>
                              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: T.inkFaint, lineHeight: 1.7 }}>
                                {c.failed_recipients.map((f: any, i: number) => <li key={i}>{f.email} — {f.reason}</li>)}
                              </ul>
                            </div>
                          )}

                          {/* Per-brother delivery, from webhook events.
                              Empty until the webhook endpoint is
                              configured and a notice is sent after that. */}
                          {recipientDetail[c.id]?.length > 0 && (
                            <div>
                              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: T.gold, letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                                DELIVERY BY RECIPIENT
                              </div>
                              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                {recipientDetail[c.id].map((r: any, i: number) => {
                                  const bad = r.status === 'bounced' || r.status === 'complained' || r.status === 'failed'
                                  return (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '3px 0', fontFamily: 'Crimson Pro, serif', fontSize: '0.85rem', color: T.inkFaint }}>
                                      <span>{r.email}</span>
                                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: bad ? T.danger : r.status === 'sent' ? T.inkFainter : T.success, whiteSpace: 'nowrap' }}>
                                        {r.status.toUpperCase()}{r.detail ? ` — ${r.detail}` : ''}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                              <p style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.8rem', color: T.inkFainter, fontStyle: 'italic', marginTop: '0.6rem', marginBottom: 0 }}>
                                SENT means Resend accepted it and no delivery event has arrived yet.
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '3rem', textAlign: 'center', color: T.inkFaint, fontStyle: 'italic' }}>No communications sent yet.</div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Send to the lodge?"
        confirmLabel={`Send to ${reachable.length}`}
        busy={busy === 'send'}
        onCancel={() => { if (busy !== 'send') setConfirmOpen(false) }}
        onConfirm={() => post('send')}
        body={
          <>
            <p style={{ marginBottom: '0.9rem' }}>
              <strong style={{ color: T.ink }}>{form.subject}</strong>
            </p>
            <p style={{ marginBottom: '0.9rem' }}>
              Goes to <strong style={{ color: T.ink }}>{reachable.length}</strong>{' '}
              {reachable.length === 1 ? 'brother' : 'brothers'} in {GROUP_LABELS[form.recipient_group]}.
              Email cannot be recalled once sent.
            </p>
            {unreachable.length > 0 && (
              <p style={{ margin: 0, color: T.danger }}>
                {unreachable.length} {unreachable.length === 1 ? 'brother has' : 'brothers have'} no email
                address on file and will not receive this.
              </p>
            )}
          </>
        }
      />
    </div>
  )
}
