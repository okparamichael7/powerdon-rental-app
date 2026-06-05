'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Zap,
  Megaphone,
  Radio,
  Cpu,
  Gift,
  Users,
  BarChart3,
  Settings,
  CreditCard,
  Activity,
  UserCircle,
  Shield,
  LifeBuoy,
  ScrollText,
} from 'lucide-react'

const NAV_ITEMS = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard, group: 'General' },
  { name: 'Sessions', href: '/admin/sessions', icon: Zap, group: 'Operations' },
  { name: 'Stations', href: '/admin/stations', icon: Radio, group: 'Operations' },
  { name: 'Hardware', href: '/admin/hardware', icon: Cpu, group: 'Operations' },
  { name: 'Ops', href: '/admin/ops', icon: Activity, group: 'Operations' },
  { name: 'Customers', href: '/admin/users', icon: Users, group: 'Customers' },
  { name: 'Leads', href: '/admin/leads', icon: UserCircle, group: 'Customers' },
  { name: 'Support', href: '/admin/support', icon: LifeBuoy, group: 'Customers' },
  { name: 'Campaigns', href: '/admin/campaigns', icon: Megaphone, group: 'Growth' },
  { name: 'Rewards', href: '/admin/rewards', icon: Gift, group: 'Growth' },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3, group: 'Growth' },
  { name: 'Billing', href: '/admin/billing', icon: CreditCard, group: 'Finance' },
  { name: 'Staff', href: '/admin/staff', icon: Shield, group: 'System', adminOnly: true },
  { name: 'Audit Log', href: '/admin/audit', icon: ScrollText, group: 'System', adminOnly: true },
  { name: 'Settings', href: '/admin/settings', icon: Settings, group: 'System' },
] as const

export function AdminCommandPalette({ isAdmin = true }: { isAdmin?: boolean }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const items = NAV_ITEMS.filter((item) => !('adminOnly' in item && item.adminOnly) || isAdmin)

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const groups = [...new Set(items.map((i) => i.group))]

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command palette" description="Navigate the admin dashboard">
      <CommandInput placeholder="Search pages…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group, groupIndex) => (
          <div key={group}>
            {groupIndex > 0 ? <CommandSeparator /> : null}
            <CommandGroup heading={group}>
              {items
                .filter((item) => item.group === group)
                .map((item) => (
                  <CommandItem key={item.href} onSelect={() => navigate(item.href)}>
                    <item.icon className="mr-2 size-4" />
                    {item.name}
                  </CommandItem>
                ))}
            </CommandGroup>
          </div>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Shortcuts">
          <CommandItem onSelect={() => setOpen(false)}>
            Close palette
            <CommandShortcut>Esc</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
