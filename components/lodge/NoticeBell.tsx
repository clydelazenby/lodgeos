import Link from 'next/link'
import { Mail } from 'lucide-react'

/**
 * Envelope in the lodge header, with a count of notices this brother
 * has not yet opened.
 *
 * Server component: the count is already known when the layout renders,
 * so this needs no client JavaScript, no fetch on mount, and no flash of
 * an empty badge before the number arrives.
 *
 * "Unread" is derived from a single timestamp per membership
 * (tenant_members.communications_last_read_at) rather than a row per
 * member per notice. For a badge that only ever answers "is there
 * anything new, and roughly how much", a timestamp is exactly as
 * accurate and enormously cheaper — see migration 017.
 */
export function NoticeBell({ href, count }: { href: string; count: number }) {
  const label =
    count === 0
      ? 'Communications — nothing new'
      : `Communications — ${count} unread ${count === 1 ? 'notice' : 'notices'}`

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: 6,
        color: '#C9A84C',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      <Mail size={17} strokeWidth={1.75} aria-hidden="true" />

      {count > 0 && (
        <span
          // aria-hidden because the count is already in the link's
          // accessible name above; announcing it twice is noise.
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: -2,
            right: -3,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 8,
            background: '#EC5B4B',
            color: '#fff',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            lineHeight: '16px',
            textAlign: 'center',
            // Ring in the header colour so the badge reads as separate
            // from the icon rather than merging into it.
            boxShadow: '0 0 0 2px #141C2E',
          }}
        >
          {/* A lodge that has not opened this in a year should show 9+,
              not a three-digit number that breaks the header. */}
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
