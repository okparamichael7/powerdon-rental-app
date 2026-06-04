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
          <CardTitle>Admin access</CardTitle>
          <CardDescription>
            Staff accounts require Supabase Auth with user_metadata.is_admin or role operator/admin.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Configure admin users in the Supabase dashboard under Authentication → Users → user metadata.
        </CardContent>
      </Card>
    </div>
  )
}
