'use client'

import { useEffect } from 'react'
import { ErrorPanel } from '@/components/ui/RouteFallbacks'

export default function LodgeError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Keeps the real error in the browser console for anyone debugging,
    // while the rendered panel stays free of database internals.
    console.error('Lodge route error:', error)
  }, [error])

  return (
    <ErrorPanel
      title="This page could not be loaded"
      description="Something went wrong fetching this lodge's records. This is usually temporary — trying again will often clear it. If it keeps happening, send the reference code below to support."
      error={error}
      reset={reset}
    />
  )
}
