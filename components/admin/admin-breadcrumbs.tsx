'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Fragment } from 'react'

const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Overview',
  sessions: 'Sessions',
  campaigns: 'Campaigns',
  stations: 'Stations',
  hardware: 'Hardware',
  rewards: 'Rewards',
  support: 'Support',
  users: 'Customers',
  leads: 'Leads',
  billing: 'Billing',
  analytics: 'Analytics',
  ops: 'Operations',
  staff: 'Staff',
  audit: 'Audit Log',
  settings: 'Settings',
  login: 'Login',
}

export function AdminBreadcrumbs() {
  const pathname = usePathname()

  if (pathname === '/admin/login') return null

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length <= 1) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Overview</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  const crumbs = segments.slice(1).map((segment, index) => {
    const href = `/admin/${segments.slice(1, index + 2).join('/')}`
    const label = SEGMENT_LABELS[segment] ?? segment.replace(/-/g, ' ')
    const isLast = index === segments.length - 2
    return { href, label, isLast }
  })

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/admin">Overview</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb) => (
          <Fragment key={crumb.href}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export function getAdminPageTitle(pathname: string): string {
  const segment = pathname.split('/').filter(Boolean).pop() ?? 'admin'
  return SEGMENT_LABELS[segment] ?? 'Admin'
}
