'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function AdminFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  children,
  activeFilters,
  onClearFilters,
  className,
}: {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  children?: React.ReactNode
  activeFilters?: { key: string; label: string; onRemove?: () => void }[]
  onClearFilters?: () => void
  className?: string
}) {
  const hasActiveFilters = (activeFilters?.length ?? 0) > 0

  return (
    <Card className={cn('shadow-none', className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {onSearchChange !== undefined ? (
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={searchValue ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9"
                aria-label="Search"
              />
            </div>
          ) : null}
          {children ? (
            <div className="flex flex-wrap items-center gap-2">{children}</div>
          ) : null}
        </div>

        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Active filters</span>
            {activeFilters!.map((filter) => (
              <Badge key={filter.key} variant="secondary" className="gap-1 pr-1 font-normal">
                {filter.label}
                {filter.onRemove ? (
                  <button
                    type="button"
                    onClick={filter.onRemove}
                    className="rounded-sm p-0.5 hover:bg-muted"
                    aria-label={`Remove ${filter.label} filter`}
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </Badge>
            ))}
            {onClearFilters ? (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearFilters}>
                Clear all
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function AdminFilterToggleGroup({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter options">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={value === option.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
