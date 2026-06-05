'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Check, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

type ThemeMode = 'light' | 'dark'

const THEMES: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export function AdminThemeToggle({
  variant = 'icon',
  className,
}: {
  variant?: 'icon' | 'segmented'
  className?: string
}) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const activeTheme = (theme === 'dark' || theme === 'light' ? theme : resolvedTheme) as
    | ThemeMode
    | undefined

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn('size-8', className)}
        aria-label="Theme"
        disabled
      >
        <Sun className="size-4" aria-hidden />
      </Button>
    )
  }

  if (variant === 'segmented') {
    return (
      <div className={cn('inline-flex rounded-lg border border-border p-1', className)} role="group" aria-label="Theme">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            type="button"
            variant={activeTheme === value ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 gap-2 px-3"
            onClick={() => setTheme(value)}
            aria-pressed={activeTheme === value}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Button>
        ))}
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', className)}
          aria-label="Change theme"
        >
          {activeTheme === 'dark' ? (
            <Moon className="size-4" aria-hidden />
          ) : (
            <Sun className="size-4" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
            <Icon className="mr-2 size-4" aria-hidden />
            {label}
            {activeTheme === value ? (
              <Check className="ml-auto size-4 text-foreground" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
