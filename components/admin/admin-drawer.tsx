'use client'

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type AdminDrawerSize = 'default' | 'wide' | 'form'

const sizeClasses: Record<AdminDrawerSize, string> = {
  default: 'sm:max-w-md md:max-w-lg',
  wide: 'sm:max-w-lg md:max-w-xl',
  form: 'sm:max-w-md md:max-w-lg',
}

export function AdminDrawer({
  open,
  onOpenChange,
  children,
  size = 'default',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  size?: AdminDrawerSize
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          'flex h-full w-full flex-col gap-0 overflow-hidden p-0',
          sizeClasses[size],
        )}
      >
        {children}
      </SheetContent>
    </Sheet>
  )
}

export function AdminDrawerHeader({
  title,
  description,
  children,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'shrink-0 border-b border-border bg-background px-6 pb-5 pt-6 pr-12',
        className,
      )}
    >
      <SheetTitle className="text-lg font-semibold leading-tight tracking-tight text-foreground">
        {title}
      </SheetTitle>
      {description ? (
        <SheetDescription className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {description}
        </SheetDescription>
      ) : null}
      {children ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </header>
  )
}

export function AdminDrawerBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5', className)}
    >
      <div className="space-y-8">{children}</div>
    </div>
  )
}

export function AdminDrawerFooter({
  children,
  className,
  align = 'end',
}: {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'end' | 'stretch'
}) {
  return (
    <footer
      className={cn(
        'shrink-0 border-t border-border bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      <div
        className={cn(
          'flex flex-col-reverse gap-2 sm:gap-3',
          align === 'end' && 'sm:flex-row sm:justify-end',
          align === 'start' && 'sm:flex-row sm:justify-start',
          align === 'stretch' && 'sm:flex-row',
        )}
      >
        {children}
      </div>
    </footer>
  )
}

export function AdminDrawerSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          {title}
        </h3>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function AdminDrawerFieldList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <dl className={cn('divide-y divide-border overflow-hidden rounded-lg border bg-muted/30', className)}>
      {children}
    </dl>
  )
}

export function AdminDrawerField({
  label,
  value,
  mono,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  valueClassName?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 sm:items-center">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-right text-sm font-medium text-foreground',
          mono && 'font-mono text-xs sm:text-sm',
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function AdminDrawerStatsGrid({
  children,
  columns = 2,
}: {
  children: React.ReactNode
  columns?: 2 | 3 | 4
}) {
  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
      )}
    >
      {children}
    </div>
  )
}

export function AdminDrawerStat({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums leading-none text-foreground">
        {value}
      </p>
    </div>
  )
}

export function AdminDrawerPanel({
  children,
  className,
  padding = 'default',
}: {
  children: React.ReactNode
  className?: string
  padding?: 'default' | 'none'
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-muted/30',
        padding === 'default' && 'p-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function AdminDrawerFormBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5', className)}>
      <div className="space-y-6">{children}</div>
    </div>
  )
}

export function AdminDrawerFormSection({
  title,
  description,
  children,
  bordered = true,
}: {
  title: string
  description?: string
  children: React.ReactNode
  bordered?: boolean
}) {
  return (
    <section
      className={cn(
        'space-y-4',
        bordered && 'border-t border-border pt-6 first:border-t-0 first:pt-0',
      )}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function AdminDrawerFormField({
  label,
  children,
  className,
  htmlFor,
}: {
  label: string
  children: React.ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  )
}

export function AdminDrawerFormRow({
  children,
  columns = 2,
}: {
  children: React.ReactNode
  columns?: 2 | 3
}) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-3',
      )}
    >
      {children}
    </div>
  )
}
