'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AdminErrorBanner, AdminEmptyState } from '@/components/admin/admin-states'
import { formatDateTime } from '@/lib/utils'
import { RefreshCw } from 'lucide-react'

type AuditRow = {
  id: string
  action: string
  role: string | null
  targetAuthUserId: string
  actorAuthUserId: string | null
  details: Record<string, unknown>
  createdAt: string
}

export default function AdminAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/audit?limit=100')
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Failed to load audit log')
        return
      }
      setRows(body.data ?? [])
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Staff Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            Grant, revoke, and role changes recorded in <code className="text-xs">staff_audit_log</code>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && <AdminErrorBanner message={error} onRetry={load} />}

      <Card>
        <CardContent className="p-0">
          {loading && !rows.length ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <AdminEmptyState title="No audit entries" description="Staff role changes will appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">When</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Target</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDateTime(new Date(row.createdAt))}
                      </td>
                      <td className="px-4 py-3 capitalize">{row.action.replace('_', ' ')}</td>
                      <td className="px-4 py-3">{row.role ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs truncate max-w-[140px]">
                        {String(row.details?.email ?? row.targetAuthUserId)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs truncate max-w-[140px]">
                        {row.actorAuthUserId ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {rows.length} entr{rows.length === 1 ? 'y' : 'ies'}. Cross-domain admin actions (sessions, campaigns) are not
        logged yet.
      </p>
    </div>
  )
}
