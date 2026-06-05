'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/** Full-height native screen — no website-style page scroll at the root. */
export function PwaScreen({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      {children}
    </div>
  )
}

/** Scroll only when content genuinely exceeds the viewport. */
export function PwaScrollBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <main
      className={cn(
        'flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4',
        '[-webkit-overflow-scrolling:touch]',
        className,
      )}
    >
      {children}
    </main>
  )
}

/** Fixed viewport body — distributes content; set scroll when content may exceed viewport. */
export function PwaBody({
  children,
  className,
  scroll = false,
}: {
  children: React.ReactNode
  className?: string
  /** Allow in-screen scroll only when content genuinely exceeds the viewport. */
  scroll?: boolean
}) {
  return (
    <main
      className={cn(
        'flex flex-1 min-h-0 flex-col px-4 py-4',
        scroll && 'overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] pwa-no-scrollbar',
        className,
      )}
    >
      {children}
    </main>
  )
}

/** Shared primary button sizing for native touch targets. */
export const PWA_BTN_CLASS = 'h-12 min-h-[44px] w-full rounded-xl text-sm font-medium'

/** Sticky action region above the tab bar. */
export function PwaActionBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'shrink-0 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur-md',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Centered empty / error / success states that fit the viewport. */
export function PwaCenteredState({
  icon,
  title,
  description,
  children,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <PwaBody className={cn('items-center justify-center text-center', className)}>
      {icon ? <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted">{icon}</div> : null}
      <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
      {description ? (
        <p className="mt-1.5 max-w-[280px] text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {children ? <div className="mt-6 w-full max-w-xs space-y-2">{children}</div> : null}
    </PwaBody>
  )
}

export function PwaSection({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-2', className)}>
      {title ? (
        <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      ) : null}
      {children}
    </section>
  )
}

export function PwaListGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border/80 bg-card divide-y divide-border/60', className)}>
      {children}
    </div>
  )
}

export function PwaListRow({
  label,
  value,
  hint,
  onClick,
  className,
}: {
  label: string
  value?: React.ReactNode
  hint?: string
  onClick?: () => void
  className?: string
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full min-h-[44px] items-center justify-between gap-3 px-4 py-3 text-left',
        onClick && 'active:bg-muted/60 transition-colors',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
      </div>
      {value != null ? (
        <div className="shrink-0 text-sm font-medium tabular-nums text-foreground">{value}</div>
      ) : null}
    </Tag>
  )
}

export function PwaMetricHero({
  label,
  value,
  sublabel,
  className,
}: {
  label: string
  value: React.ReactNode
  sublabel?: string
  className?: string
}) {
  return (
    <div className={cn('py-2 text-center', className)}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p> : null}
    </div>
  )
}
