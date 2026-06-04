'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'

type StaffRow = {
  id: string
  authUserId: string
  email: string
  role: 'admin' | 'operator'
  grantedAt: string
}

type AuditRow = {
  id: string
  action: string
  role: string | null
  targetAuthUserId: string
  actorAuthUserId: string | null
  createdAt: string
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/staff')
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to load staff')
        return
      }
      setStaff(body.data ?? [])
      setAudit(body.audit ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to grant access')
        return
      }
      setEmail('')
      await load()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async (authUserId: string) => {
    if (!confirm('Revoke staff access for this user?')) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${encodeURIComponent(authUserId)}`, {
        method: 'DELETE',
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to revoke')
        return
      }
      await load()
    } catch {
      setError('Network error')
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff access</h1>
        <p className="text-muted-foreground">
          Manage dashboard roles in <code className="text-xs">staff_roles</code> (linked to Supabase Auth).
          Rental customers stay in the <code className="text-xs">users</code> table.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grant access</CardTitle>
          <CardDescription>
            User must already exist under Supabase Authentication → Users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGrant} className="flex flex-col sm:flex-row gap-3">
            <Input
              type="email"
              placeholder="staff@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="flex-1"
            />
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'operator')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="mr-2" /> : null}
              Grant
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active staff</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-4">{error}</p>}
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No staff roles yet. Run migration <code className="text-xs">007_staff_roles</code>, set{' '}
              <code className="text-xs">BOOTSTRAP_ADMIN_EMAIL</code> for first login, or grant manually above.
            </p>
          ) : (
            <ul className="divide-y">
              {staff.map((row) => (
                <li key={row.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{row.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{row.authUserId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={row.role === 'admin' ? 'default' : 'secondary'}>{row.role}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevoke(row.authUserId)}
                    >
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>Recent grant and revoke actions</CardDescription>
        </CardHeader>
        <CardContent>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {audit.map((row) => (
                <li key={row.id} className="py-2 flex justify-between gap-4">
                  <span>
                    <span className="font-medium">{row.action}</span>
                    {row.role ? ` · ${row.role}` : ''}
                  </span>
                  <span className="text-muted-foreground text-xs shrink-0">
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
