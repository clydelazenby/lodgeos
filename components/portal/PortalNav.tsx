'use client'

import { useState } from 'react'
import Link from 'next/link'

/**
 * The brother portal's navigation.
 *
 * TWO THINGS THIS FIXED.
 *
 * 1. There was no way to sign out. The lodge side has had a Sign Out
 *    button since it was built; the portal — where every brother now
 *    lands, officers included — had none at all. On a shared or family
 *    device that is not a missing convenience, it is a man unable to
 *    close his own session.
 *
 * 2. On a phone the links wrapped into a second and third row under the
 *    lodge name, pushing the page content down before it began. They
 *    now collapse behind a menu button, which is what the row of links
 *    was already straining to avoid with `flex-wrap`.
 *
 * The menu is CSS-driven rather than JS-measured: `lodgeos-portal-menu`
 * hides the button above the breakpoint and the inline row below it
 * (see globals.css), so there is no flash of the wrong layout while
 * JavaScript loads and no window-width state to keep in sync.
 */
export function PortalNav({
  firstName,
  lodgeHref,
}: {
  firstName?: string | null
  /** Only officers and super admins get this; undefined hides it. */
  lodgeHref?: string
}) {
  const [open, setOpen] = useState(false)

  const LINKS: [string, string][] = [
    ['Dashboard', '/portal'],
    ['Check In', '/portal/check-in'],
    ['Events', '/portal/events'],
    ['Notices', '/portal/notices'],
    ['Roster', '/portal/roster'],
    ['Documents', '/portal/documents'],
    ['Dues', '/portal/dues'],
    ['Profile', '/portal/profile'],
  ]

  const linkStyle = {
    fontFamily: 'Cinzel, serif', fontSize: '0.68rem', color: '#B8B0A0',
    textDecoration: 'none', letterSpacing: '0.05em',
  }

  const lodgeLinkStyle = {
    fontFamily: 'Cinzel, serif', fontSize: '0.66rem', color: '#C9A84C',
    textDecoration: 'none', letterSpacing: '0.05em',
    border: '1px solid rgba(201,168,76,0.3)', padding: '6px 12px', borderRadius: 4,
    whiteSpace: 'nowrap' as const,
  }

  /**
   * A form POST, not a link. Signing out changes server state, and a
   * GET can be prefetched or followed by a scanner — which would sign
   * a brother out without him touching anything.
   */
  const signOut = (
    <form action="/auth/signout" method="post" style={{ margin: 0 }}>
      <button
        type="submit"
        style={{
          background: 'none', border: '1px solid rgba(184,176,160,0.3)', borderRadius: 4,
          color: '#B8B0A0', fontFamily: 'Cinzel, serif', fontSize: '0.64rem',
          letterSpacing: '0.05em', padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        Sign Out
      </button>
    </form>
  )

  return (
    <>
      {/* Wide screens: everything inline, as before. */}
      <div className="lodgeos-portal-nav" style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {LINKS.map(([label, href]) => (
          <Link key={label} href={href} style={linkStyle}>{label}</Link>
        ))}
        {lodgeHref && <Link href={lodgeHref} style={lodgeLinkStyle}>Lodge Administration →</Link>}
        {firstName && (
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', color: '#C9A84C' }}>
            {firstName}
          </span>
        )}
        {signOut}
      </div>

      {/* Narrow screens: one button, and a panel beneath the header. */}
      <div className="lodgeos-portal-menu">
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          style={{
            background: 'none', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 4,
            color: '#C9A84C', fontSize: '1rem', lineHeight: 1, padding: '8px 12px', cursor: 'pointer',
          }}
        >
          {open ? '✕' : '☰'}
        </button>

        {open && (
          <div
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#141C2E', borderTop: '1px solid rgba(201,168,76,0.15)',
              borderBottom: '1px solid rgba(201,168,76,0.15)',
              display: 'flex', flexDirection: 'column', gap: '0.25rem',
              padding: '0.75rem 1rem', zIndex: 200,
            }}
          >
            {LINKS.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                onClick={() => setOpen(false)}
                style={{ ...linkStyle, fontSize: '0.8rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(201,168,76,0.07)' }}
              >
                {label}
              </Link>
            ))}
            {lodgeHref && (
              <Link
                href={lodgeHref}
                onClick={() => setOpen(false)}
                style={{ ...linkStyle, color: '#C9A84C', fontSize: '0.8rem', padding: '0.6rem 0', borderBottom: '1px solid rgba(201,168,76,0.07)' }}
              >
                Lodge Administration →
              </Link>
            )}
            <div style={{ paddingTop: '0.6rem' }}>{signOut}</div>
          </div>
        )}
      </div>
    </>
  )
}
