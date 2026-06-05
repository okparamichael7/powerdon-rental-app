'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminEmptyState } from '@/components/admin/admin-states'

export function AdminDataTableCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden shadow-none', className)}>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  )
}

export function AdminDataTable({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <Table>{children}</Table>
    </div>
  )
}

export function AdminDataTableHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <TableHeader className={cn('sticky top-0 z-10 bg-muted/30 backdrop-blur-sm [&_tr]:border-b', className)}>
      {children}
    </TableHeader>
  )
}

export function AdminDataTableHead({
  children,
  className,
  sortable,
  sorted,
  onSort,
}: {
  children: React.ReactNode
  className?: string
  sortable?: boolean
  sorted?: 'asc' | 'desc' | false
  onSort?: () => void
}) {
  if (sortable && onSort) {
    return (
      <TableHead className={cn('text-xs font-medium uppercase tracking-wide text-muted-foreground', className)}>
        <button
          type="button"
          onClick={onSort}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          {children}
          {sorted ? (
            <span className="text-[10px] text-foreground" aria-hidden>
              {sorted === 'asc' ? '↑' : '↓'}
            </span>
          ) : null}
        </button>
      </TableHead>
    )
  }

  return (
    <TableHead
      className={cn('text-xs font-medium uppercase tracking-wide text-muted-foreground', className)}
    >
      {children}
    </TableHead>
  )
}

export function AdminDataTableRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <TableRow
      className={cn(
        onClick && 'cursor-pointer hover:bg-muted/40',
        className,
      )}
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {children}
    </TableRow>
  )
}

export function AdminDataTableCell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <TableCell className={cn('text-sm', className)}>{children}</TableCell>
}

export function AdminDataTableEmpty({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="px-4 py-8">
      <AdminEmptyState title={title} description={description} />
    </div>
  )
}

export function AdminMobileCardList({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('divide-y divide-border lg:hidden', className)}>{children}</div>
}

export function AdminMobileCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <div
      className={cn(
        'space-y-2 p-4 transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/30 active:bg-muted/50',
        className,
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}

export function AdminDesktopOnly({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('hidden lg:block', className)}>{children}</div>
}
