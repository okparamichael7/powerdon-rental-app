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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminErrorBanner, AdminEmptyState } from '@/components/admin/admin-states'
import { toast } from '@/components/admin/admin-providers'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [revokeTarget, setRevokeTarget] = useState<StaffRow | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

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
        toast.error(body.error || 'Failed to grant access')
        return
      }
      setEmail('')
      toast.success(`Access granted to ${email}`)
      await load()
    } catch {
      setError('Network error')
      toast.error('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeTarget) return
    setRevoking(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/staff/${encodeURIComponent(revokeTarget.authUserId)}`, {
        method: 'DELETE',
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to revoke')
        toast.error(body.error || 'Failed to revoke access')
        return
      }
      toast.success(`Access revoked for ${revokeTarget.email}`)
      setRevokeTarget(null)
      await load()
    } catch {
      setError('Network error')
      toast.error('Network error')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <AdminPageHeader
        title="Staff access"
        description="Grant dashboard roles to team members"
        meta={
          staff.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {staff.length} active staff member{staff.length === 1 ? '' : 's'}
            </p>
          ) : null
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={load} />}

      <Card>
        <CardHeader>
          <CardTitle>Grant access</CardTitle>
          <CardDescription>
            The user must already exist in your authentication provider.
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
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : staff.length === 0 ? (
            <AdminEmptyState
              title="No staff members yet"
              description="Grant access above to add your first team member."
            />
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
                      onClick={() => setRevokeTarget(row)}
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
            <AdminEmptyState title="No audit entries yet" />
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
                  Database setup and bootstrap instructions
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
            <CardContent className="space-y-2 border-t border-border/60 pt-4 text-sm text-muted-foreground">
              <p>
                Roles are stored in <code className="text-xs">staff_roles</code> (linked to Supabase Auth).
                Rental customers stay in the <code className="text-xs">users</code> table.
              </p>
              <p>
                First-time setup: run migration <code className="text-xs">007_staff_roles</code>, set{' '}
                <code className="text-xs">BOOTSTRAP_ADMIN_EMAIL</code> for first login, or grant manually above.
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke staff access</DialogTitle>
            <DialogDescription>
              {revokeTarget
                ? `Remove dashboard access for ${revokeTarget.email}? They will no longer be able to sign in to the admin panel.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)} disabled={revoking}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? <Spinner className="mr-2 size-4" /> : null}
              Revoke access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
