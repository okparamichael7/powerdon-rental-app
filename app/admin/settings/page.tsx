'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AdminSettingsPage() {
  const checks = [
    { name: 'Supabase URL', ok: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { name: 'Stripe publishable', ok: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) },
    { name: 'Mock data mode', ok: process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' },
    { name: 'App URL', ok: Boolean(process.env.NEXT_PUBLIC_APP_URL) },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Environment and deployment configuration (read-only).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Runtime configuration</CardTitle>
          <CardDescription>Values exposed to the browser are shown here. Secrets are configured server-side only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checks.map((c) => (
            <div key={c.name} className="flex items-center justify-between py-2 border-b last:border-0">
              <span className="text-sm">{c.name}</span>
              <Badge variant={c.ok ? 'default' : 'secondary'}>{c.ok ? 'Set' : 'Not set'}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Staff access</CardTitle>
          <CardDescription>
            Roles are stored in <code className="text-xs">staff_roles</code> (linked to Supabase Auth). JWT
            app_metadata is synced automatically on grant/revoke.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Manage staff at <a href="/admin/staff" className="underline text-foreground">/admin/staff</a> (admin
            only). First deploy: run migration 007 and set <code className="text-xs">BOOTSTRAP_ADMIN_EMAIL</code>{' '}
            to your Auth user email for one-time bootstrap on login.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
