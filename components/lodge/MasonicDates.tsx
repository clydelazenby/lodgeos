'use client'
import { useState } from 'react'
import { T } from '@/lib/designTokens'
import { yearsOfService, serviceLabel } from '@/lib/anniversaries'

/**
 * Initiated, passed, raised.
 *
 * The three dates a brother would name if asked when he became a Mason,
 * none of which the app previously held. They are copied off the old
 * lodge register — degree_progress only knows about candidates who came
 * through while the lodge was using LodgeOS, which is nobody whose
 * fiftieth year is approaching.
 *
 * Only the Secretary's office sees the inputs. Everyone else sees the
 * dates as text, because they are worth reading on a profile whether or
 * not you may change them.
 */
export function MasonicDates({
  tenantId,
  memberId,
  initial,
  canEdit,
}: {
  tenantId: string
  memberId: string
  initial: { initiated_date: string | null; passed_date: string | null; raised_date: string | null }
  canEdit: boolean
}) {
  const [dates, setDates] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const years = dates.raised_date ? yearsOfService(dates.raised_date, new Date()) : null

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/members/dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, memberId, dates }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Ordering and future-date refusals land here. Kept on screen
        // rather than toasted away — the Secretary is reading a date
        // off a register and needs to see which one was wrong.
        setError(data.error || 'Could not save those dates.')
        return
      }
      setDates(data.dates)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e?.message || 'Could not save those dates.')
    } finally {
      setSaving(false)
    }
  }

  const label = (text: string) => (
    <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.1em', color: T.inkFaint, textTransform: 'uppercase', marginBottom: 5 }}>
      {text}
    </div>
  )

  const readable = (iso: string | null) =>
    iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Not recorded'

  const field = (key: keyof typeof dates, text: string) => (
    <div>
      {label(text)}
      {canEdit ? (
        <input
          type="date"
          value={dates[key] ?? ''}
          onChange={(e) => setDates((p) => ({ ...p, [key]: e.target.value || null }))}
          style={{
            width: '100%', background: T.bg, border: `1px solid ${T.border}`, color: T.ink,
            padding: '8px 10px', borderRadius: 6, fontFamily: T.mono, fontSize: '0.75rem',
          }}
        />
      ) : (
        <div style={{ fontFamily: T.body, fontSize: '0.9rem', color: T.ink }}>{readable(dates[key])}</div>
      )}
    </div>
  )

  const dirty =
    dates.initiated_date !== initial.initiated_date ||
    dates.passed_date !== initial.passed_date ||
    dates.raised_date !== initial.raised_date

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
        <div style={{ fontFamily: T.display, fontSize: '1rem', color: T.ink }}>Masonic Record</div>
        {years !== null && years > 0 && (
          <span className="pill pill-fc" title="Counted from his raising">
            {serviceLabel(years)} a Master Mason
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.9rem' }}>
        {field('initiated_date', 'Initiated')}
        {field('passed_date', 'Passed')}
        {field('raised_date', 'Raised')}
      </div>

      {canEdit && (
        <>
          <p style={{ fontFamily: T.body, fontSize: '0.82rem', color: T.inkFaint, fontStyle: 'italic', margin: '0.8rem 0 0' }}>
            Copy these from the lodge register. The raising date is the one that matters most — it
            is what his years of service, his anniversary and any service jewel are counted from.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
            <button
              onClick={save}
              disabled={saving || !dirty}
              style={{
                background: T.gold, color: T.bg, border: 'none', padding: '9px 22px', borderRadius: 6,
                fontFamily: T.display, fontSize: '0.82rem', fontWeight: 600,
                cursor: saving || !dirty ? 'not-allowed' : 'pointer', opacity: saving || !dirty ? 0.5 : 1,
              }}
            >
              {saving ? 'Saving…' : 'Save Dates'}
            </button>
            {saved && (
              <span style={{ fontFamily: T.mono, fontSize: '0.62rem', color: T.success, letterSpacing: '0.1em' }}>
                ✓ SAVED
              </span>
            )}
          </div>

          {error && (
            <div style={{ marginTop: '0.7rem', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.25)', color: T.danger, padding: '8px 12px', borderRadius: 6, fontFamily: T.body, fontSize: '0.88rem' }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  )
}
