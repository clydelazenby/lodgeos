'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { T } from '@/lib/designTokens'

/**
 * Detail card for an officer, opened by tapping their chair on the
 * floor plan.
 *
 * The plan can only ever show an avatar and an abbreviated station
 * label — that constraint is what makes it fit on a phone at all. This
 * is where the rest lives: full name, the office in full, degree,
 * contact details, and whether they were present at the selected
 * meeting.
 *
 * Reads only what the Lodge Room page already loaded, so opening it
 * costs no round trip.
 */

const DEGREE_LABEL: Record<string, string> = {
  EA: 'Entered Apprentice',
  FC: 'Fellowcraft',
  MM: 'Master Mason',
}

const STATUS_LABEL: Record<string, string> = {
  present: 'Present',
  excused: 'Excused',
  absent: 'Absent',
}

export type StationSelection = {
  station: string
  holder: any | null
  status?: string
  meetingLabel?: string
}

export function StationMemberModal({
  selection,
  slug,
  onClose,
}: {
  selection: StationSelection | null
  slug: string
  onClose: () => void
}) {
  useEffect(() => {
    if (!selection) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // Stop the page behind scrolling under the sheet on a phone.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [selection, onClose])

  if (!selection) return null

  const { station, holder, status, meetingLabel } = selection
  const p = holder?.profiles
  const name = p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : null
  const initials = p ? `${p.first_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}`.toUpperCase() : '—'

  const statusTone =
    status === 'present' ? T.success : status === 'excused' ? T.gold : T.danger

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '9px 0', borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.15em', color: T.gold, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: 'Crimson Pro, serif', fontSize: '0.95rem', color: T.ink, textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${station} details`}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bgCard, border: `1px solid ${T.goldBorder}`, borderRadius: 10,
          padding: '1.75rem', width: '100%', maxWidth: 380, maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <span style={{ fontFamily: T.mono, fontSize: '0.58rem', letterSpacing: '0.2em', color: T.gold, textTransform: 'uppercase' }}>
            {station}
          </span>
          <button onClick={onClose} aria-label="Close"
            style={{ background: 'transparent', border: 'none', color: T.inkFaint, cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: 0 }}>
            ×
          </button>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 96, height: 96, borderRadius: '50%', margin: '0 auto 0.9rem',
              overflow: 'hidden', background: T.bgPanel,
              border: `2px solid ${holder ? T.gold : T.inkFainter}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {p?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-uploaded Supabase Storage URL
              <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontFamily: T.display, fontSize: '1.8rem', color: holder ? T.gold : T.inkFainter }}>{initials}</span>
            )}
          </div>

          <div style={{ fontFamily: T.display, fontSize: '1.2rem', color: T.ink }}>
            {name ? `Bro. ${name}` : 'Unassigned'}
          </div>

          {!holder && (
            <p style={{ fontFamily: 'Crimson Pro, serif', color: T.inkFaint, fontStyle: 'italic', margin: '6px 0 0', fontSize: '0.9rem' }}>
              No brother is filling this station. Assign one from the Members page.
            </p>
          )}
        </div>

        {holder && (
          <div style={{ marginBottom: '1.5rem' }}>
            {row('Office', station)}
            {row('Degree', DEGREE_LABEL[holder.degree] ?? holder.degree ?? '—')}
            {p?.email && row('Email', <a href={`mailto:${p.email}`} style={{ color: T.gold, textDecoration: 'none' }}>{p.email}</a>)}
            {p?.phone && row('Phone', <a href={`tel:${p.phone}`} style={{ color: T.gold, textDecoration: 'none' }}>{p.phone}</a>)}
            {/* Only meaningful once a meeting is selected — otherwise the
                page is showing stations, not a particular communication. */}
            {meetingLabel && row(
              'At this meeting',
              <span style={{ color: statusTone }}>{status ? (STATUS_LABEL[status] ?? status) : 'Not recorded'}</span>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {holder && (
            <Link
              href={`/lodge/${slug}/members/${holder.user_id}`}
              style={{
                fontFamily: T.mono, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase',
                background: T.gold, color: T.bg, padding: '11px 18px', borderRadius: 4, textDecoration: 'none',
              }}
            >
              Full Profile
            </Link>
          )}
          <Link
            href={`/lodge/${slug}/members`}
            style={{
              fontFamily: T.mono, fontSize: '0.6rem', letterSpacing: '0.1em', textTransform: 'uppercase',
              background: 'transparent', border: `1px solid ${T.goldBorder}`, color: T.gold,
              padding: '11px 18px', borderRadius: 4, textDecoration: 'none',
            }}
          >
            {holder ? 'Change Station' : 'Assign Station'}
          </Link>
        </div>
      </div>
    </div>
  )
}
