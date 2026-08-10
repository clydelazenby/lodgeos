import React from 'react'
import { T } from '@/lib/designTokens'

/**
 * Shared building blocks for Next.js route boundaries (loading.tsx /
 * error.tsx / not-found.tsx).
 *
 * These live in one file rather than being written inline per segment
 * for the same reason lib/designTokens.ts exists: the previous pattern
 * of hand-copying a style block per page is what let this app drift
 * into two competing visual systems. A skeleton that doesn't match the
 * real page it stands in for is worse than no skeleton, because the
 * layout visibly jumps when content arrives.
 */

/** A single shimmering placeholder block. */
export function SkeletonBlock({
  height = 20,
  width = '100%',
  radius = 4,
}: {
  height?: number | string
  width?: number | string
  radius?: number
}) {
  return (
    <div
      className="lodgeos-skeleton"
      style={{
        height,
        width,
        borderRadius: radius,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(201,168,76,0.08)',
      }}
    />
  )
}

/**
 * Card-grid skeleton approximating the shape shared by the dashboard,
 * dues, members, and analytics pages: a title, a row of stat cards,
 * then a long content panel.
 */
export function PageSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} aria-hidden="true">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        <SkeletonBlock height={11} width={110} />
        <SkeletonBlock height={28} width={260} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
          gap: '1rem',
        }}
      >
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            style={{
              background: T.bgCard,
              border: `1px solid ${T.goldBorder}`,
              borderRadius: 6,
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <SkeletonBlock height={10} width={70} />
            <SkeletonBlock height={26} width={90} />
          </div>
        ))}
      </div>

      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.goldBorder}`,
          borderRadius: 6,
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <SkeletonBlock height={14} width={150} />
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} height={16} />
        ))}
      </div>

      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.6rem',
          letterSpacing: '0.2em',
          color: T.inkFainter,
        }}
      >
        LOADING…
      </span>
    </div>
  )
}

/**
 * Error boundary body. `reset` comes from Next.js and re-runs the
 * failed segment's render — worth offering, because the most common
 * cause here is a transient Supabase hiccup rather than a real bug.
 *
 * Deliberately does NOT print error.message to the page. A thrown
 * Postgres error can carry column names, constraint names, and
 * fragments of row data; a lodge secretary can't act on any of that and
 * it shouldn't be shown to whoever happens to be at the screen. The
 * digest is Next.js's stable hash of the real error, which is what
 * actually correlates to the server log.
 */
export function ErrorPanel({
  title,
  description,
  error,
  reset,
}: {
  title: string
  description: string
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: '100%',
          background: T.bgCard,
          border: `1px solid ${T.goldBorder}`,
          borderRadius: 8,
          padding: '2.5rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.6rem',
            letterSpacing: '0.25em',
            color: T.danger,
            marginBottom: '1rem',
          }}
        >
          SOMETHING WENT WRONG
        </div>

        <h1
          style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '1.3rem',
            color: T.ink,
            marginBottom: '0.75rem',
          }}
        >
          {title}
        </h1>

        <p
          style={{
            fontFamily: 'Crimson Pro, serif',
            fontSize: '1rem',
            color: T.inkFaint,
            lineHeight: 1.7,
            marginBottom: '2rem',
          }}
        >
          {description}
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset} className="btn-gold" style={{ cursor: 'pointer' }}>
            Try Again
          </button>
          <a
            href="/"
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '0.7rem',
              letterSpacing: '0.1em',
              color: T.inkFaint,
              textDecoration: 'none',
              padding: '12px 20px',
              border: `1px solid ${T.goldBorder}`,
              borderRadius: 4,
            }}
          >
            Go Home
          </a>
        </div>

        {error.digest && (
          <div
            style={{
              marginTop: '2rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.58rem',
              color: T.inkFainter,
            }}
          >
            REFERENCE: {error.digest}
          </div>
        )}
      </div>
    </div>
  )
}
