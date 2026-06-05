'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { PwaBody, PwaScreen } from '@/components/pwa/pwa-screen'
import { MobileHeader } from '@/components/volt/mobile-header'

export function PwaLoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <PwaScreen>
      <MobileHeader statusBadge="Loading" />
      <PwaBody className="items-center justify-center">
        <div className="w-full max-w-xs space-y-4">
          <Skeleton className="mx-auto size-12 rounded-2xl" />
          <Skeleton className="mx-auto h-4 w-32" />
          <p className="text-center text-sm text-muted-foreground">{message}</p>
        </div>
      </PwaBody>
    </PwaScreen>
  )
}

export function PwaListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
          <Skeleton className="size-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
