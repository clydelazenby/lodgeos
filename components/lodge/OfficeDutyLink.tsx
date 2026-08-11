'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { T } from '@/lib/designTokens'
import { callApi, errorMessage } from '@/lib/clientFetch'

/**
 * An office name that answers "what does that mean?" where it is
 * written.
 *
 * THE GREETING IS WHERE THE QUESTION OCCURS TO HIM. "Good afternoon,
 * Secretary Clyde" is the app telling a brother what he is; the natural
 * next thought is what that involves, and the natural place to answer
 * it is the word itself — not a page he has to know exists, under a
 * menu he has to know to open.
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  /**
   * ASKED ONCE PER OFFICE, NOT ONCE PER RENDER.
   *
   * This first read `if (!open || data || loading) return` and depended
   * on `loading`. Fine while the request succeeds, and wrong the moment
   * it fails: on the error path `data` stays null and `loading` goes
   * back to false, so the effect's own dependencies fired it again —
   * and again — hammering the server and leaving the panel reading
   * LOADING for ever, because every cycle set it back to true. It
   * looked like a glitch because it was one.
   *
   * A ref records that the question has been asked, so a failure stays
   * a failure and can actually be read.
   */
  const asked = useRef<string | null>(null)

  // A different chair is a different answer; forget the last one.
  useEffect(() => {
    asked.current = null
    setData(null)
    setError('')
  }, [office])

  useEffect(() => {
    if (!open || asked.current === office) return
    asked.current = office
    setLoading(true)
    setError('')

    /**
     * METHOD 'GET', SPELLED OUT.
     *
     * callApi defaults to POST — it was written for saves and every
     * other caller is one. Omitting it here sent a POST to a route that
     * has only GET and PATCH, which Next answers 405. Two bugs that hid
     * each other: the request was wrong, and the loop above never let
     * the wrongness surface.
     */
    callApi<Loaded>(
      `/api/duties?tenantId=${encodeURIComponent(tenantId)}&office=${encodeURIComponent(office)}`,
      { method: 'GET' }
    )
      .then(setData)
      .catch(e => setError(errorMessage(e, 'Those duties could not be loaded.')))
      .finally(() => setLoading(false))
  }, [open, office, tenantId])

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

  const retry = () => {
    asked.current = null
    setError('')
    setLoading(true)
    callApi<Loaded>(
      `/api/duties?tenantId=${encodeURIComponent(tenantId)}&office=${encodeURIComponent(office)}`,
      { method: 'GET' }
    )
      .then(setData)
      .catch(e => setError(errorMessage(e, 'Those duties could not be loaded.')))
      .finally(() => { asked.current = office; setLoading(false) })
  }

  if (!office.trim()) return null

  const trigger = (
    <button
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-label={`What the ${office} does`}
      title={`What the ${office} does`}
      style={{
        background: 'none', border: 'none', padding: 0, margin: 0, cursor: 'pointer',
        font: 'inherit',
        /**
         * THREE SIGNALS, NOT ONE.
         *
         * A plain underline in the heading's own colour was too quiet to
         * read as a control — reported as exactly that. So: it is GOLD,
         * this app's colour for everything you can act on; the underline
         * is DOTTED, the long-standing convention for "there is an
         * explanation behind this word" as distinct from a solid one
         * meaning "this navigates"; and it carries a small circled i,
         * which survives being printed, screenshotted, or read by
         * someone who cannot see the gold.
         *
         * Any one of the three alone is missable, and colour alone says
         * nothing inside a heading that is already partly gold.
         */
        color: T.gold,
        textDecoration: 'underline',
        textDecorationStyle: 'dotted',
        textDecorationColor: 'rgba(201,168,76,0.8)',
        textUnderlineOffset: '4px',
        textDecorationThickness: '1.5px',
        ...style,
      }}
    >
      {office}
      <span
        aria-hidden="true"
        style={{ fontSize: '0.62em', verticalAlign: 'super', marginLeft: '0.18em', opacity: 0.85 }}
      >
        &#9432;
      </span>
    </button>
  )

  const dialog = open ? (
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
          maxHeight: '85vh', overflowY: 'auto', textAlign: 'left',
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

        {error && !loading && (
          <>
            <p style={{ fontFamily: T.body, fontSize: '0.92rem', color: T.danger, marginTop: '1.2rem' }}>
              {error}
            </p>
            {/* A dead end is worse than a failure. The full page still
                works even when this request will not come back. */}
            <button
              onClick={retry}
              style={{
                background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '4px',
                color: T.inkFaint, fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em',
                textTransform: 'uppercase', padding: '7px 11px', marginTop: '0.6rem', cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </>
        )}

        {data && !loading && (
          <>
            {data.holders.length > 0 && (
              <div style={{ fontFamily: T.mono, fontSize: '9.5px', letterSpacing: '0.08em', color: T.gold, marginTop: '0.9rem' }}>
                {data.holders.join(', ').toUpperCase()}
              </div>
            )}

            <p style={{ fontFamily: T.body, fontSize: '1rem', color: T.inkFaint, lineHeight: 1.75, margin: '0.9rem 0 0', whiteSpace: 'pre-wrap' }}>
              {data.duties || 'Nothing has been written for this office yet.'}
            </p>

            {/* Whose words these are. A general description the lodge has
                never approved must not read as its own — duties differ by
                jurisdiction and by bylaw. */}
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
            View all brother duties &rarr;
          </Link>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {trigger}
      {/*
        * PORTALLED TO THE BODY, and this is not tidiness.
        *
        * The greeting it sits in is an <h1> on the lodge dashboard and a
        * <p> in the portal. A <div> inside either is invalid HTML, and
        * the parser does not merely tolerate it — it CLOSES THE <p>
        * before the div, producing a DOM that does not match the tree
        * React rendered on the server. That is a hydration mismatch, and
        * its symptoms are exactly the sort of intermittent misbehaviour
        * that gets reported as "it's glitching".
        *
        * A modal is fixed-position and belongs to the viewport, not to
        * the sentence that opened it, so the body is where it should
        * have gone in the first place.
        */}
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  )
}
