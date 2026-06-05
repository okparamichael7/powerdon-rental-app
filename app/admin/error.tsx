'use client'

import { useEffect } from 'react'
import { AdminErrorBanner } from '@/components/admin/admin-states'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { Button } from '@/components/ui/button'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Something went wrong"
        description="An unexpected error occurred while loading this page."
      />
      <AdminErrorBanner
        message={error.message || 'Unable to load admin page'}
        onRetry={reset}
      />
      <Button variant="outline" onClick={() => (window.location.href = '/admin')}>
        Return to overview
      </Button>
    </div>
  )
}
