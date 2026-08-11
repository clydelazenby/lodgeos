'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { T } from '@/lib/designTokens'
import { callApi, errorMessage } from '@/lib/clientFetch'

/**
 * An office name that answers "what does that mean?" where it is
 * written.
 *
 * THE GREETING IS WHERE THE QUESTION OCCURS TO HIM. "Good evening,
 * Senior Warden" is the app telling a brother what he is; the natural
 * next thought is what that involves, and the natural place to answer
 * it is the word itself — not a page he has to know exists, under a
 * menu he has to know to open.
 *
 * UNDERLINED, because a thing that opens something must look like it
 * does. Colour alone is not enough: it is invisible to a colour-blind
 * reader, and inside a heading that is already gold it says nothing at
 * all.
 *
 * FETCHED ON OPEN, not shipped with the page. The greeting is on two
 * dashboards and a profile header; sending several paragraphs of prose
 * with every one of them, on the chance somebody taps it, is a cost
 * paid by everyone for the few who do.
 */

type Loaded = {
  office: string
  duties: string
  custom: boolean
  updatedByName: string | null
  holders: string[]
}

export function OfficeDutyLink({
  tenantId, office, allHref, style,
}: {
  tenantId: string
  office: string
  /** Where "view all brother duties" goes — differs by side of the app. */
  allHref: string
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || data || loading) return
    setLoading(true)
    setError('')
    callApi(`/api/duties?tenantId=${encodeURIComponent(tenantId)}&office=${encodeURIComponent(office)}`)
      .then(d => setData(d as Loaded))
      .catch(e => setError(errorMessage(e, 'Those duties could not be loaded.')))
      .finally(() => setLoading(false))
  }, [open, data, loading, tenantId, office])

  // Escape closes, and the page behind does not scroll while it is up.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open])

  if (!office.trim()) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`What the ${office} does`}
        title={`What the ${office} does`}
        style={{
          background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
          font: 'inherit', color: 'inherit',
          textDecoration: 'underline',
          textDecorationColor: 'rgba(201,168,76,0.55)',
          textUnderlineOffset: '3px',
          textDecorationThickness: '1px',
          ...style,
        }}
      >
        {office}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Duties of the ${office}`}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(6,10,17,0.78)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="lodgeos-dialog-in"
            style={{
              background: T.bgCard, border: `1px solid ${T.borderStrong}`, borderRadius: '10px',
              padding: '1.5rem', width: '100%', maxWidth: 560,
              maxHeight: '85vh', overflowY: 'auto',
              textAlign: 'left', font: 'initial',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.16em', color: T.gold, textTransform: 'uppercase' }}>
                  Duties of the
                </div>
                <h2 style={{ fontFamily: T.display, fontSize: '1.3rem', color: T.ink, margin: '4px 0 0' }}>
                  {office}
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: 'none', border: 'none', color: T.inkFaint, fontSize: '1.6rem', lineHeight: 1, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
              >
                ×
              </button>
            </div>

            {loading && (
              <p className="lodgeos-pulse" style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.12em', color: T.gold, marginTop: '1.2rem' }}>
                LOADING…
              </p>
            )}

            {error && (
              <p style={{ fontFamily: T.body, fontSize: '0.92rem', color: T.danger, marginTop: '1.2rem' }}>
                {error}
              </p>
            )}

            {data && (
              <>
                {data.holders.length > 0 && (
                  <div style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em', color: T.gold, marginTop: '0.9rem' }}>
                    {data.holders.join(', ').toUpperCase()}
                  </div>
                )}

                <p style={{ fontFamily: T.body, fontSize: '1rem', color: T.inkFaint, lineHeight: 1.75, margin: '0.9rem 0 0', whiteSpace: 'pre-wrap' }}>
                  {data.duties || 'Nothing has been written for this office yet.'}
                </p>

                {/* Whose words these are. A general description the
                    lodge has never approved must not read as its own —
                    duties differ by jurisdiction and by bylaw. */}
                <p style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: '0.84rem', color: T.inkFainter, marginTop: '0.9rem' }}>
                  {data.custom
                    ? `Written by this lodge${data.updatedByName ? ` — last changed by ${data.updatedByName}` : ''}.`
                    : 'A general description, not this lodge’s own wording. Duties differ by jurisdiction and by bylaw.'}
                </p>
              </>
            )}

            <div style={{ marginTop: '1.4rem', borderTop: `1px solid ${T.border}`, paddingTop: '1rem' }}>
              <Link
                href={allHref}
                onClick={() => setOpen(false)}
                style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.12em', color: T.gold, textDecoration: 'none', textTransform: 'uppercase' }}
              >
                View all brother duties →
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
