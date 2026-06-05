'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TableBody } from '@/components/ui/table'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import {
  AdminDataTableCard,
  AdminDataTable,
  AdminDataTableHeader,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableCell,
  AdminDataTableEmpty,
  AdminMobileCardList,
  AdminMobileCard,
  AdminDesktopOnly,
} from '@/components/admin/admin-data-table'
import { AdminPaginationBar } from '@/components/admin/admin-pagination-bar'
import { AdminTableSkeleton, AdminCardListSkeleton } from '@/components/admin/admin-skeletons'
import { AdminErrorBanner } from '@/components/admin/admin-states'
import { useAdminPagination } from '@/hooks/use-admin-pagination'
import { useTableSort } from '@/hooks/use-table-sort'
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

  const { page, pageSize, setPage, setPageSize } = useAdminPagination()

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

  const total = rows.length
  const { sorted: sortedRows, sortOrder, toggleSort, isSorted } = useTableSort(
    rows,
    'createdAt',
    'desc',
  )
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize])

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Staff Audit Log"
        description="Grant, revoke, and role changes recorded in staff_audit_log"
        meta={
          total > 0 ? (
            <p className="text-xs text-muted-foreground">{total} entries loaded</p>
          ) : null
        }
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={load} />}

      <AdminDataTableCard>
        {loading ? (
          <>
            <AdminDesktopOnly>
              <AdminTableSkeleton rows={pageSize} columns={5} />
            </AdminDesktopOnly>
            <AdminCardListSkeleton count={5} />
          </>
        ) : rows.length === 0 ? (
          <AdminDataTableEmpty
            title="No audit entries"
            description="Staff role changes will appear here."
          />
        ) : (
          <>
            <AdminDesktopOnly>
              <AdminDataTable>
                <AdminDataTableHeader>
                  <AdminDataTableRow>
                    <AdminDataTableHead
                      sortable
                      sorted={isSorted('createdAt') ? sortOrder : false}
                      onSort={() => toggleSort('createdAt')}
                    >
                      When
                    </AdminDataTableHead>
                    <AdminDataTableHead>Action</AdminDataTableHead>
                    <AdminDataTableHead>Role</AdminDataTableHead>
                    <AdminDataTableHead>Target</AdminDataTableHead>
                    <AdminDataTableHead>Actor</AdminDataTableHead>
                  </AdminDataTableRow>
                </AdminDataTableHeader>
                <TableBody>
                  {paginatedRows.map((row) => (
                    <AdminDataTableRow key={row.id}>
                      <AdminDataTableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(new Date(row.createdAt))}
                      </AdminDataTableCell>
                      <AdminDataTableCell className="capitalize">
                        {row.action.replace('_', ' ')}
                      </AdminDataTableCell>
                      <AdminDataTableCell>{row.role ?? '—'}</AdminDataTableCell>
                      <AdminDataTableCell className="max-w-[140px] truncate font-mono text-xs">
                        {String(row.details?.email ?? row.targetAuthUserId)}
                      </AdminDataTableCell>
                      <AdminDataTableCell className="max-w-[140px] truncate font-mono text-xs">
                        {row.actorAuthUserId ?? '—'}
                      </AdminDataTableCell>
                    </AdminDataTableRow>
                  ))}
                </TableBody>
              </AdminDataTable>
            </AdminDesktopOnly>

            <AdminMobileCardList>
              {paginatedRows.map((row) => (
                <AdminMobileCard key={row.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium capitalize">{row.action.replace('_', ' ')}</p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(new Date(row.createdAt))}
                    </p>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <span className="text-foreground">Role:</span> {row.role ?? '—'}
                    </p>
                    <p className="truncate font-mono">
                      <span className="font-sans text-foreground">Target:</span>{' '}
                      {String(row.details?.email ?? row.targetAuthUserId)}
                    </p>
                    <p className="truncate font-mono">
                      <span className="font-sans text-foreground">Actor:</span>{' '}
                      {row.actorAuthUserId ?? '—'}
                    </p>
                  </div>
                </AdminMobileCard>
              ))}
            </AdminMobileCardList>

            <AdminPaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </AdminDataTableCard>

      <p className="text-xs text-muted-foreground/70">Staff role grants and revokes only.</p>
    </div>
  )
}
