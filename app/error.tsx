'use client'

import { useEffect } from 'react'
import { ErrorPanel } from '@/components/ui/RouteFallbacks'
import { T } from '@/lib/designTokens'

/**
 * Root-level catch-all. Segment-specific boundaries (lodge, portal,
 * super-admin) handle their own errors and keep their surrounding
 * chrome; this one catches anything outside those segments — the public
 * lodge pages, onboarding, auth — where there is no chrome to preserve,
 * so it paints its own full-page background.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled route error:', error)
  }, [error])

  return (
    <div style={{ minHeight: '100vh', background: T.bg }}>
      <ErrorPanel
        title="Something went wrong"
        description="This page failed to load. Trying again will often clear it — if it doesn't, the reference code below identifies this specific failure in the server logs."
        error={error}
        reset={reset}
      />
    </div>
  )
}
