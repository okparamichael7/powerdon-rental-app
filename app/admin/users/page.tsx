'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Download, Users } from 'lucide-react'
import { TableBody } from '@/components/ui/table'
import { useUsers } from '@/hooks/use-services'
import { downloadCsv } from '@/lib/admin/export-csv'
import { AdminErrorBanner } from '@/components/admin/admin-states'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminFilterBar } from '@/components/admin/admin-filter-bar'
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
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useAdminPagination } from '@/hooks/use-admin-pagination'
import { useTableSort } from '@/hooks/use-table-sort'
import { formatDateTime } from '@/lib/utils'
import { useState } from 'react'

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebouncedValue(searchQuery)
  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = useAdminPagination()
  const { data: users, loading, error, total, fetchUsers, refetch } = useUsers()

  useEffect(() => {
    resetPage()
  }, [debouncedSearch, resetPage])

  useEffect(() => {
    fetchUsers({
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...paginationParams,
    })
  }, [debouncedSearch, paginationParams, fetchUsers])

  const rows = users ?? []
  const { sorted: sortedRows, sortOrder, toggleSort, isSorted } = useTableSort(rows, 'createdAt', 'desc')

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Customers"
        description="Registered renters and account profiles"
        meta={
          total > 0 ? (
            <p className="text-xs text-muted-foreground">{total} customers</p>
          ) : null
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={!rows.length}
            onClick={() =>
              downloadCsv(
                'powerdon-users.csv',
                ['email', 'name', 'totalRentals', 'marketingConsent', 'createdAt'],
                rows.map((u) => [
                  u.email,
                  u.name ?? '',
                  u.totalRentals,
                  u.marketingConsent,
                  new Date(u.createdAt).toISOString(),
                ]),
              )
            }
          >
            <Download className="mr-2 size-4" aria-hidden />
            Export
          </Button>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={() => refetch()} />}

      <AdminFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by email or name…"
        onClearFilters={searchQuery ? () => setSearchQuery('') : undefined}
        activeFilters={
          searchQuery
            ? [{ key: 'search', label: `Search: ${searchQuery}`, onRemove: () => setSearchQuery('') }]
            : []
        }
      />

      <AdminDataTableCard>
        {loading ? (
          <>
            <AdminDesktopOnly>
              <AdminTableSkeleton columns={4} />
            </AdminDesktopOnly>
            <AdminCardListSkeleton />
          </>
        ) : rows.length === 0 ? (
          <AdminDataTableEmpty
            title="No customers yet"
            description="Users are created when someone rents a power bank."
          />
        ) : (
          <>
            <AdminDesktopOnly>
              <AdminDataTable>
                <AdminDataTableHeader>
                  <AdminDataTableRow>
                    <AdminDataTableHead>Email</AdminDataTableHead>
                    <AdminDataTableHead>Name</AdminDataTableHead>
                    <AdminDataTableHead className="text-right">Rentals</AdminDataTableHead>
                    <AdminDataTableHead
                      sortable
                      sorted={isSorted('createdAt') ? sortOrder : false}
                      onSort={() => toggleSort('createdAt')}
                    >
                      Joined
                    </AdminDataTableHead>
                  </AdminDataTableRow>
                </AdminDataTableHeader>
                <TableBody>
                  {sortedRows.map((user) => (
                    <AdminDataTableRow key={user.id}>
                      <AdminDataTableCell>{user.email}</AdminDataTableCell>
                      <AdminDataTableCell className="text-muted-foreground">
                        {user.name ?? '—'}
                      </AdminDataTableCell>
                      <AdminDataTableCell className="text-right tabular-nums">
                        {user.totalRentals}
                      </AdminDataTableCell>
                      <AdminDataTableCell className="text-muted-foreground">
                        {formatDateTime(new Date(user.createdAt))}
                      </AdminDataTableCell>
                    </AdminDataTableRow>
                  ))}
                </TableBody>
              </AdminDataTable>
            </AdminDesktopOnly>

            <AdminMobileCardList>
              {rows.map((user) => (
                <AdminMobileCard key={user.id}>
                  <p className="text-sm font-medium">{user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.name ?? 'No name'}</p>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{user.totalRentals} rentals</span>
                    <span>{formatDateTime(new Date(user.createdAt))}</span>
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

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="size-3" aria-hidden />
        View lead profiles and marketing consent on the{' '}
        <Link href="/admin/leads" className="font-medium text-foreground underline-offset-4 hover:underline">
          Leads
        </Link>{' '}
        page.
      </p>
    </div>
  )
}
