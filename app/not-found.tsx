import Link from 'next/link'
import { T } from '@/lib/designTokens'

/**
 * Catches every notFound() in the app. The one that matters most is
 * app/[slug]/page.tsx, which calls notFound() when a lodge slug doesn't
 * resolve — previously that showed the bare Next.js 404, with nothing
 * to indicate whether the lodge had moved, been renamed, or never
 * existed.
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '1.3rem',
            fontWeight: 700,
            color: T.gold,
            letterSpacing: '0.2em',
            marginBottom: '3rem',
          }}
        >
          LODGEOS
        </div>

        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.goldBorder}`,
            borderRadius: 8,
            padding: '3rem 2.5rem',
          }}
        >
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.6rem',
              letterSpacing: '0.25em',
              color: T.inkFaint,
              marginBottom: '1rem',
            }}
          >
            404 — NOT FOUND
          </div>

          <h1
            style={{
              fontFamily: 'Cinzel, serif',
              fontSize: '1.4rem',
              color: T.ink,
              marginBottom: '1rem',
            }}
          >
            No Lodge At This Address
          </h1>

          <p
            style={{
              fontFamily: 'Crimson Pro, serif',
              fontSize: '1.05rem',
              color: T.inkFaint,
              lineHeight: 1.7,
              marginBottom: '2.5rem',
            }}
          >
            This page doesn&apos;t exist, or the lodge you&apos;re looking for
            isn&apos;t on LodgeOS under this address. Check the link for a typo —
            lodge pages use the form{' '}
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', color: T.gold }}>
              /lodge-name-number
            </span>
            .
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="btn-gold">
              Go Home
            </Link>
            <Link
              href="/auth/login"
              style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: T.inkFaint,
                textDecoration: 'none',
                padding: '14px 32px',
                border: `1px solid ${T.goldBorder}`,
                display: 'inline-block',
              }}
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
