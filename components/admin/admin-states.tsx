'use client'

import { AlertCircle, Inbox, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AdminErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />
        <p className="text-sm text-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  )
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground/50" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
    </div>
  )
}
