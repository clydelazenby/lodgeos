'use client'

import { useEffect } from 'react'
import { ErrorPanel } from '@/components/ui/RouteFallbacks'

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Portal route error:', error)
  }, [error])

  return (
    <ErrorPanel
      title="Your portal could not be loaded"
      description="Something went wrong fetching your membership record. This is usually temporary — try again in a moment. If it persists, your lodge secretary can check whether your membership is still marked active."
      error={error}
      reset={reset}
    />
  )
}
