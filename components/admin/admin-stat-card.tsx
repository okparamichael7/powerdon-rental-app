'use client'

import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

type Trend = 'positive' | 'negative' | 'neutral' | 'warning'

export function AdminStatCard({
  label,
  value,
  description,
  icon: Icon,
  trend = 'neutral',
  variant = 'default',
  className,
}: {
  label: string
  value: React.ReactNode
  description?: string
  icon?: LucideIcon
  trend?: Trend
  variant?: 'default' | 'secondary'
  className?: string
}) {
  const trendClass =
    trend === 'positive'
      ? 'text-emerald-600 dark:text-emerald-400'
      : trend === 'negative'
        ? 'text-destructive'
        : trend === 'warning'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-muted-foreground'

  return (
    <Card
      className={cn(
        variant === 'secondary' && 'border-dashed bg-muted/20 shadow-none',
        className,
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="text-2xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
              {value}
            </p>
            {description ? (
              <p className={cn('text-xs', trendClass)}>{description}</p>
            ) : null}
          </div>
          {Icon ? (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function AdminStatGrid({
  children,
  columns = 4,
  className,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
