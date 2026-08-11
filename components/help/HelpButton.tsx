'use client'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { T } from '@/lib/designTokens'
import { helpTopic, helpBookHref, resolveHelpTopic, type HelpTopic } from '@/lib/help'
import { HelpArticle } from './HelpArticle'

/**
 * The ? in the header. Help for the page you are actually on.
 *
 * THE PAGE ANSWERS THE QUESTION, NOT A MENU. A man stuck on the dues
 * page does not want a table of contents; he wants the paragraph about
 * dues. usePathname() already knows which screen he is looking at, so
 * he never chooses a topic — he presses one button and reads the right
 * thing.
 *
 * ONE FIXED POSITION, NOT A ? PER SECTION. Scattering little marks
 * beside individual controls means learning where each one is. In the
 * header it is in the same place on all thirty-nine screens, which is
 * the only property that makes it findable at all.
 *
 * Portalled to the body for the same reason OfficeDutyLink is: a
 * fixed-position dialog belongs to the viewport, not to the header it
 * was opened from, and nesting one inside a flex row that also
 * contains a sticky header is how you get a modal that scrolls with
 * the page or clips at its edge.
 */

export function HelpButton() {
  const pathname = usePathname() || '/'
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  /** Set when a "see also" is followed, so Back can return. */
  const [followed, setFollowed] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  const pageTopic = useMemo(() => resolveHelpTopic(pathname), [pathname])

  // Moving to another page invalidates whatever was open: the ? now
  // means something else.
  useEffect(() => {
    setOpen(false)
    setFollowed(null)
  }, [pathname])

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

  const shown: HelpTopic | null = (followed ? helpTopic(followed) : null) ?? pageTopic
  const bookHref = helpBookHref(pathname, shown?.key ?? null)

  const trigger = (
    <button
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-label={shown ? `Help with ${shown.title}` : 'Help'}
      title={shown ? `Help with ${shown.title}` : 'Help'}
      style={{
        // 34px, matching the notice bell it stands beside — and a tap
        // target a thumb can actually hit. A 20px ? is a decoration.
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: 'transparent', border: `1px solid ${T.goldBorder}`, color: T.gold,
        fontFamily: T.mono, fontSize: '14px', lineHeight: 1, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
      }}
    >
      ?
    </button>
  )

  const dialog = open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={shown ? `Help — ${shown.title}` : 'Help'}
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 330, background: 'rgba(6,10,17,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="lodgeos-dialog-in"
        style={{
          background: T.bgCard, border: `1px solid ${T.borderStrong}`, borderRadius: '10px',
          padding: '1.5rem', width: '100%', maxWidth: 620,
          maxHeight: '85vh', overflowY: 'auto', textAlign: 'left', minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.16em', color: T.gold, textTransform: 'uppercase' }}>
              {shown ? shown.where : 'Help'}
            </div>
            <h2 style={{ fontFamily: T.display, fontSize: '1.3rem', color: T.ink, margin: '4px 0 0' }}>
              {shown ? shown.title : 'Help'}
            </h2>
            {shown && (
              <p style={{ fontFamily: T.body, fontStyle: 'italic', fontSize: '0.95rem', color: T.inkFainter, margin: '4px 0 0' }}>
                {shown.lead}
              </p>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ background: 'none', border: 'none', color: T.inkFaint, fontSize: '1.6rem', lineHeight: 1, cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        <div style={{ marginTop: '1.2rem' }}>
          {shown ? (
            <HelpArticle topic={shown} onFollow={setFollowed} />
          ) : (
            /* Not every screen has its own page. Saying so, and
               pointing at the whole book, beats an empty panel that
               reads as broken. */
            <p style={{ fontFamily: T.body, fontSize: '1rem', lineHeight: 1.7, color: T.inkFaint, margin: 0 }}>
              There is nothing written for this screen yet. The rest of the guide is below —
              or ask the Secretary, who has the same guide.
            </p>
          )}
        </div>

        <div
          style={{
            marginTop: '1.4rem', borderTop: `1px solid ${T.border}`, paddingTop: '1rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
          }}
        >
          {followed && followed !== pageTopic?.key ? (
            <button
              onClick={() => setFollowed(null)}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.12em',
                color: T.inkFaint, textTransform: 'uppercase',
              }}
            >
              &larr; Back to this page
            </button>
          ) : (
            <span />
          )}
          <Link
            href={bookHref}
            onClick={() => setOpen(false)}
            style={{ fontFamily: T.mono, fontSize: '10px', letterSpacing: '0.12em', color: T.gold, textDecoration: 'none', textTransform: 'uppercase' }}
          >
            The whole guide &rarr;
          </Link>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      {trigger}
      {mounted && dialog ? createPortal(dialog, document.body) : null}
    </>
  )
}
