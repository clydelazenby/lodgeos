'use client'

import { useEffect, useState } from 'react'
import { T } from '@/lib/designTokens'

/**
 * The personalised dashboard greeting.
 *
 * WHY THIS IS A CLIENT COMPONENT
 *
 * The greeting was a hardcoded "Good Evening" addressed to the LODGE
 * ("Good Evening, Psalms of Job Lodge #1827") rather than to the
 * officer signed in. Making it time-aware on the server would be worse
 * than hardcoding: Vercel's servers run in UTC, so a Worshipful Master
 * opening this at 8pm in North Carolina would be told "Good morning" —
 * 1am UTC. Time of day is a property of the reader, not the server.
 *
 * So the time-based part is computed in the browser after mount. The
 * first paint shows the neutral "Welcome" to keep the server and client
 * markup identical — rendering a guessed greeting server-side and then
 * correcting it is exactly what produces a React hydration mismatch.
 * The name and office render immediately either way; only the two words
 * before the comma settle a beat later.
 */
function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardGreeting({
  firstName,
  lastName,
  avatarUrl,
  lodgeRole,
  tenantRole,
  lodgeName,
  lodgeNumber,
  subline,
}: {
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  /** Free-text office title, e.g. "Senior Warden". Preferred when set. */
  lodgeRole: string | null
  /** Permission tier, the fallback when no office title is recorded. */
  tenantRole: string | null
  lodgeName: string
  lodgeNumber: string
  subline: string
}) {
  const [greeting, setGreeting] = useState('Welcome')

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()))
  }, [])

  const name = firstName?.trim() || 'Brother'
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?'

  // lodge_role is the actual office ("Senior Warden"); tenant_role is
  // the permission tier ("secretary", "worshipful_master"). Prefer the
  // real title, and only fall back to prettifying the tier — a brother
  // holding no office simply gets no title line rather than being
  // labelled "member", which reads as a demotion rather than a fact.
  const office =
    lodgeRole?.trim() ||
    (tenantRole && tenantRole !== 'member'
      ? tenantRole.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
      : null)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem', flexWrap: 'wrap' }}>
      <div
        style={{
          width: 58, height: 58, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          background: T.bgPanel, border: `2px solid ${T.goldBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-uploaded Supabase Storage URL, not a static asset
          <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontFamily: T.display, fontSize: '1.15rem', color: T.gold }}>{initials}</span>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontFamily: T.display, fontSize: '1.5rem', fontWeight: 600, color: T.ink, margin: 0, lineHeight: 1.25 }}>
          {greeting}, {office ? `${office} ` : 'Bro. '}
          <span style={{ color: T.gold }}>{name}</span>
        </h1>
        <p style={{ fontFamily: T.body, color: T.inkFaint, margin: '3px 0 0', fontSize: '0.88rem' }}>
          {lodgeName} #{lodgeNumber} · {subline}
        </p>
      </div>
    </div>
  )
}
