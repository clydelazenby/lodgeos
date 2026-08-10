'use client'

import { useEffect } from 'react'
import { ErrorPanel } from '@/components/ui/RouteFallbacks'

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Super-admin route error:', error)
  }, [error])

  return (
    <ErrorPanel
      title="Platform console unavailable"
      description="Something went wrong loading platform data. Individual lodges are unaffected by this error — it is scoped to the super-admin console."
      error={error}
      reset={reset}
    />
  )
}
