'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminThemeToggle } from '@/components/admin/admin-theme-toggle'
import { getAdminDataSource, isMockDataEnabled } from '@/lib/services/config'
import { ChevronDown, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AdminSettingsPage() {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const pwaMock = isMockDataEnabled()

  const checks = [
    {
      name: 'Database',
      ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      label: undefined as string | undefined,
    },
    {
      name: 'Payments',
      ok: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
      label: undefined,
    },
    {
      name: 'App URL',
      ok: Boolean(process.env.NEXT_PUBLIC_APP_URL),
      label: undefined,
    },
    {
      name: 'Data source',
      ok: true,
      label: 'Live',
    },
    {
      name: 'Customer app demo mode',
      ok: !pwaMock,
      label: pwaMock ? 'On' : 'Off',
    },
  ]

  const advancedChecks = [
    { name: 'Supabase URL', ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { name: 'Stripe publishable key', ok: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) },
    { name: 'App URL', ok: Boolean(process.env.NEXT_PUBLIC_APP_URL) },
    {
      name: 'Admin data source',
      ok: true,
      label: getAdminDataSource(),
    },
    {
      name: 'PWA mock mode (customer app only)',
      ok: !pwaMock,
      label: pwaMock ? 'Enabled' : 'Disabled',
    },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <AdminPageHeader
        title="Settings"
        description="System configuration and service status"
      />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose light or dark mode for the admin dashboard. Your preference is saved on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminThemeToggle variant="segmented" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service status</CardTitle>
          <CardDescription>
            Read-only overview of connected services. Contact your administrator to change configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checks.map((c) => (
            <div key={c.name} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm font-medium">{c.name}</span>
              <div className="flex items-center gap-2">
                {c.ok ? (
                  <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                ) : (
                  <XCircle className="size-4 text-destructive" aria-hidden />
                )}
                <Badge variant={c.ok ? 'secondary' : 'destructive'}>
                  {'label' in c && c.label ? c.label : c.ok ? 'Ready' : 'Not configured'}
                </Badge>
              </div>
            </div>
          ))}
          {pwaMock && (
            <p className="text-sm text-muted-foreground pt-2">
              Demo mode is enabled for the customer app. The admin dashboard always uses live data.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff access</CardTitle>
          <CardDescription>
            Grant dashboard roles to team members who already have accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Manage staff at{' '}
            <Link href="/admin/staff" className="underline text-foreground">
              Staff access
            </Link>
            . Only admins can grant or revoke roles.
          </p>
        </CardContent>
      </Card>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <Card className="border-dashed bg-muted/20 shadow-none">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between px-6 py-4 text-left"
            >
              <div>
                <p className="text-sm font-medium text-muted-foreground">Advanced</p>
                <p className="text-xs text-muted-foreground/80">
                  Environment variables and deployment details
                </p>
              </div>
              <ChevronDown
                className={cn(
                  'size-4 text-muted-foreground transition-transform',
                  advancedOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 border-t border-border/60 pt-4 text-sm text-muted-foreground">
              <p>
                Admin always uses production APIs via{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">lib/services/index.ts</code>.
                PWA mock is independent.
              </p>

              <div className="space-y-2">
                {advancedChecks.map((c) => (
                  <div key={c.name} className="flex items-center justify-between py-1.5">
                    <span>{c.name}</span>
                    <Badge variant={c.ok ? 'outline' : 'destructive'} className="font-normal">
                      {'label' in c && c.label ? c.label : c.ok ? 'Set' : 'Not set'}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="font-medium text-foreground">Staff roles</p>
                <p>
                  Roles are stored in <code className="text-xs">staff_roles</code> (linked to Supabase Auth).
                  JWT app_metadata is synced automatically on grant/revoke.
                </p>
                <p>
                  First deploy: run migration 007 and set{' '}
                  <code className="text-xs">BOOTSTRAP_ADMIN_EMAIL</code> to your Auth user email for
                  one-time bootstrap on login.
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  )
}
