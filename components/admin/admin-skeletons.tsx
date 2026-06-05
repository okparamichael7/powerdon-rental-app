import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function AdminStatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function AdminTableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-0">
      <div className="flex gap-4 border-b bg-muted/30 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4 border-b border-border/50 px-4 py-4">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={col} className={cn('h-4 flex-1', col === 0 && 'max-w-[180px]')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function AdminCardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-border lg:hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2 p-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

export function AdminChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="p-6 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

export function AdminCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function AdminPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <AdminStatGridSkeleton />
      <Card>
        <CardContent className="p-0">
          <AdminTableSkeleton />
        </CardContent>
      </Card>
    </div>
  )
}
