'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { STAFF_PASSWORD_MIN_LENGTH } from '@/lib/security/staff-password'
import { ChevronDown, Eye, EyeOff, Mail, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'

type ProvisionMethod = 'password' | 'invite'

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
  details?: Record<string, unknown>
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<'admin' | 'operator'>('operator')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<StaffRow | null>(null)
  const [revoking, setRevoking] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [provisionMethod, setProvisionMethod] = useState<ProvisionMethod>('password')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/staff', { credentials: 'include' })
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

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setError(null)

    if (provisionMethod === 'password' && password !== confirmPassword) {
      setFormError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        email,
        provisionMethod,
        role,
        notes: notes.trim() || undefined,
      }
      if (provisionMethod === 'password') {
        payload.password = password
      }

      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const body = await res.json()
      if (!res.ok) {
        const msg =
          body.details?.[0]?.message ||
          body.error ||
          'Failed to add staff member'
        setFormError(msg)
        toast.error(msg)
        return
      }

      const data = body.data
      if (data?.provisionMethod === 'invite') {
        if (data.inviteSent) {
          toast.success(`Invite email sent to ${email}`)
        } else if (data.existingAccountLinked) {
          toast.success(
            `Staff access granted for ${email}. They already have an auth account — they can sign in or use Forgot password.`,
          )
        } else {
          toast.success(`Staff invite processed for ${email}`)
        }
      } else {
        const created = Boolean(data?.authUserCreated)
        toast.success(
          created
            ? `Staff account created for ${email}`
            : `Staff access granted and password updated for ${email}`,
        )
      }
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setNotes('')
      await load()
    } catch {
      setFormError('Network error')
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
        credentials: 'include',
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
        description="Create staff accounts and manage dashboard roles"
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
          <CardTitle>Add staff member</CardTitle>
          <CardDescription>
            Set a password yourself or send a Supabase invite email so they choose their own
            credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateStaff} className="space-y-4">
            <Tabs
              value={provisionMethod}
              onValueChange={(v) => setProvisionMethod(v as ProvisionMethod)}
            >
              <TabsList className="w-full sm:w-auto">
                <TabsTrigger value="password" className="gap-1.5">
                  <KeyRound className="size-3.5" />
                  Set password
                </TabsTrigger>
                <TabsTrigger value="invite" className="gap-1.5">
                  <Mail className="size-3.5" />
                  Send invite
                </TabsTrigger>
              </TabsList>

              <TabsContent value="password" className="mt-4 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Creates the account immediately. Share the password securely — it is never shown
                  again after submission.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="staff-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="staff-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required={provisionMethod === 'password'}
                        minLength={STAFF_PASSWORD_MIN_LENGTH}
                        autoComplete="new-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Min {STAFF_PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, and a
                      number.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="staff-confirm">Confirm password</Label>
                    <Input
                      id="staff-confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required={provisionMethod === 'password'}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="invite" className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Supabase sends an invite email with a link to set their password and access the
                  admin dashboard. Requires Auth SMTP in your Supabase project and{' '}
                  <code className="text-xs">NEXT_PUBLIC_APP_URL</code> in this app.
                </p>
                <p className="text-xs text-muted-foreground">
                  If the email already has an auth account, staff access is granted and they can
                  sign in with existing credentials or Forgot password.
                </p>
              </TabsContent>
            </Tabs>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="staff-email">Work email</Label>
                <Input
                  id="staff-email"
                  type="email"
                  placeholder="operator@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'operator')}>
                  <SelectTrigger id="staff-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — full access</SelectItem>
                    <SelectItem value="operator">Operator — day-to-day ops</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-notes">Notes (optional)</Label>
                <Input
                  id="staff-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Event ops lead"
                />
              </div>
            </div>

            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? <Spinner className="mr-2 size-4" /> : null}
              {provisionMethod === 'invite' ? 'Send invite' : 'Create staff account'}
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
              description="Add your first team member using the form above."
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
                    <Button variant="outline" size="sm" onClick={() => setRevokeTarget(row)}>
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
          <CardDescription>Recent staff provisioning and access changes</CardDescription>
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
                    {row.details?.provisionedFromDashboard ? ' · provisioned' : ''}
                    {row.details?.provisionMethod === 'invite' ? ' · invite' : ''}
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
                  Bootstrap and security notes
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
                Roles are stored in <code className="text-xs">staff_roles</code> and mirrored to
                Supabase Auth <code className="text-xs">app_metadata</code> for RLS.
              </p>
              <p>
                First-time bootstrap: set <code className="text-xs">BOOTSTRAP_ADMIN_EMAIL</code> or
                create the first admin via this form.
              </p>
              <p>
                Password mode updates credentials for existing auth users without staff access.
                Invite mode sends a Supabase invite email for new users.
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
                ? `Remove dashboard access for ${revokeTarget.email}? They will no longer be able to sign in to the admin panel. Their auth account remains in Supabase.`
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
