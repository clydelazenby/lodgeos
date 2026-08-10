'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { SecretaryConversation } from './ai/SecretaryConversation'
import { SquareAndCompasses } from './ai/Emblem'

/**
 * The docked AI Secretary — a launcher, and the sheet it opens.
 *
 * The conversation itself lives in SecretaryConversation, shared with
 * the full page at /lodge/[slug]/secretary. This file is only about
 * where the thing sits and how you get into it.
 *
 * WHY THERE IS A FULL PAGE AT ALL. A 380px box is fine for "who owes
 * dues" and wrong for the job this was built for: an officer drafting a
 * set of minutes was writing six hundred words into a window the size of
 * a business card, unable to see the top of his own draft. The bubble
 * answers questions; the page writes documents. Same conversation
 * underneath, so moving between them loses nothing.
 */

/**
 * How far the officer must scroll down before the launcher gets out of
 * the way. Small enough to react, large enough that a stray pixel of
 * momentum does not make it flicker.
 */
const HIDE_AFTER_SCROLL = 24

/**
 * How the header button reaches this component.
 *
 * On a phone the launcher used to float over the page — which meant it
 * sat on top of whatever happened to be under it, and the fix for that
 * was to keep shrinking it and hiding it on scroll. Both are treatments
 * for a self-inflicted wound. Below 641px it is now a button in the top
 * bar, beside the notice bell, where every other global control already
 * lives and where it covers nothing.
 *
 * That button renders in a server layout far from this component's tree,
 * so a plain window event carries the click rather than threading a
 * context provider through the whole lodge shell for one boolean.
 */
export const AI_OPEN_EVENT = 'lodgeos:ai-open'

export function AiSecretaryLauncherButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent(AI_OPEN_EVENT))}
      className="lodgeos-ai-header-btn"
      aria-label="Ask the Secretary"
      title="Ask the Secretary"
      style={{
        background: 'none',
        border: 'none',
        color: '#C9A84C',
        cursor: 'pointer',
        padding: '8px 4px',
        display: 'none',
        alignItems: 'center',
      }}
    >
      <SquareAndCompasses size={19} />
    </button>
  )
}

export function AiSecretaryPanel({
  tenantId,
  slug,
  canSendNotices,
}: {
  tenantId: string
  slug: string
  canSendNotices: boolean
}) {
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)
  const pathname = usePathname()

  // The full page IS the assistant. A floating button offering to open a
  // small copy of what already fills the screen is noise.
  const onSecretaryPage = (pathname ?? '').endsWith('/secretary')

  useEffect(() => {
    const openIt = () => setOpen(true)
    window.addEventListener(AI_OPEN_EVENT, openIt)
    return () => window.removeEventListener(AI_OPEN_EVENT, openIt)
  }, [])

  /**
   * THE LAUNCHER GETS OUT OF THE WAY WHILE READING.
   *
   * Only relevant to the floating pill, which now exists on desktop
   * only — the phone's launcher is in the top bar and has nothing to get
   * out of the way of. Scrolling DOWN (reading) tucks it away, scrolling
   * UP or stopping brings it back.
   */
  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      if (Math.abs(y - lastY) > 4) {
        setHidden(y > lastY && y > HIDE_AFTER_SCROLL)
        lastY = y
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /**
   * On a phone the panel is a full-screen sheet, and the page behind it
   * must stop scrolling — otherwise a swipe meant for the conversation
   * drags the lodge dashboard around underneath, which is a large part
   * of why the whole thing felt broken. Desktop keeps its docked card
   * and its scrollable page.
   */
  useEffect(() => {
    if (!open) return
    if (!window.matchMedia('(max-width: 640px)').matches) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  /**
   * Navigating closes the sheet.
   *
   * Insurance rather than the fix — raising the panel above the header
   * puts the nav out of reach while it is open, so this should no
   * longer be reachable on a phone. But a full-screen sheet left
   * covering a page the officer has just navigated to is an unusually
   * bad failure: the app looks frozen, and the only visible control is
   * one that has nothing to do with where he was going. Cheap to make
   * impossible twice.
   *
   * Sheet widths only. On a desktop the docked card blocks nothing, and
   * carrying a conversation across pages is the point of keeping it.
   */
  useEffect(() => {
    if (!open) return
    if (!window.matchMedia('(max-width: 640px)').matches) return
    setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on route change only
  }, [pathname])

  /** Escape closes it, as it closes every other dialog in the app. */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (onSecretaryPage) return null

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="lodgeos-ai-launcher"
        aria-label="Ask the Secretary"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '16px',
          zIndex: 50,
          background: '#C9A84C',
          color: '#0A0E1A',
          border: 'none',
          padding: '11px 18px',
          borderRadius: '999px',
          cursor: 'pointer',
          fontFamily: 'Cinzel, serif',
          fontSize: '0.78rem',
          fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          // Tucked away while reading, not removed: a display:none
          // button cannot be tabbed back to, and the transform keeps it
          // reachable by keyboard throughout.
          transform: hidden ? 'translateY(140%)' : 'translateY(0)',
          opacity: hidden ? 0 : 1,
          transition: 'transform 0.22s ease, opacity 0.22s ease',
        }}
      >
        <SquareAndCompasses size={17} />
        <span>Ask the Secretary</span>
      </button>
    )
  }

  return (
    <div className="lodgeos-ai-panel" role="dialog" aria-label="AI Secretary">
      <SecretaryConversation
        tenantId={tenantId}
        slug={slug}
        canSendNotices={canSendNotices}
        onClose={() => setOpen(false)}
        onNavigate={() => setOpen(false)}
      />
    </div>
  )
}
