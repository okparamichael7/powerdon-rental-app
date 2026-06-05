'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TableBody } from '@/components/ui/table'
import { StatusBadge } from '@/components/volt/status-badge'
import { AdminPageHeader } from '@/components/admin/admin-page-header'
import { AdminFilterBar, AdminFilterToggleGroup } from '@/components/admin/admin-filter-bar'
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
import { useSupportTickets } from '@/hooks/use-services'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useAdminPagination } from '@/hooks/use-admin-pagination'
import { useTableSort } from '@/hooks/use-table-sort'
import { supportService } from '@/lib/services'
import { isSuccessResponse } from '@/lib/api/client'
import { formatDateTime } from '@/lib/utils'
import { formatStatusLabel } from '@/lib/admin/status-config'
import type { SupportTicket } from '@/lib/api/types'
import { RefreshCw } from 'lucide-react'

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting_customer', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export default function SupportPage() {
  const { data: tickets, loading, error, total, fetchTickets, refetch } = useSupportTickets()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchQuery)
  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = useAdminPagination()

  useEffect(() => {
    resetPage()
  }, [debouncedSearch, statusFilter, resetPage])

  useEffect(() => {
    const filters: Parameters<typeof fetchTickets>[0] = {
      ...paginationParams,
    }
    if (debouncedSearch) filters.search = debouncedSearch
    if (statusFilter !== 'all') {
      filters.status = [statusFilter as SupportTicket['status']]
    }
    fetchTickets(filters)
  }, [debouncedSearch, statusFilter, paginationParams, fetchTickets])

  const handleStatusChange = async (id: string, status: SupportTicket['status']) => {
    setUpdatingId(id)
    try {
      const res = await supportService.updateTicketStatus(id, status)
      if (isSuccessResponse(res)) refetch()
    } finally {
      setUpdatingId(null)
    }
  }

  const rows = tickets ?? []
  const { sorted: sortedRows, sortOrder, toggleSort, isSorted } = useTableSort(
    rows,
    'createdAt',
    'desc',
  )

  const activeFilters = [
    ...(debouncedSearch
      ? [{ key: 'search', label: `Search: ${debouncedSearch}`, onRemove: () => setSearchQuery('') }]
      : []),
    ...(statusFilter !== 'all'
      ? [
          {
            key: 'status',
            label: `Status: ${formatStatusLabel(statusFilter)}`,
            onRemove: () => setStatusFilter('all'),
          },
        ]
      : []),
  ]

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support Tickets"
        description="Customer support cases from the database"
        meta={
          total > 0 ? (
            <p className="text-xs text-muted-foreground">{total} total tickets</p>
          ) : null
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={() => refetch()} />}

      <AdminFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by ticket number, subject, or email…"
        activeFilters={activeFilters}
        onClearFilters={activeFilters.length ? clearFilters : undefined}
      >
        <AdminFilterToggleGroup
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
        />
      </AdminFilterBar>

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
            title="No support tickets"
            description="Tickets appear when customers submit the support form."
          />
        ) : (
          <>
            <AdminDesktopOnly>
              <AdminDataTable>
                <AdminDataTableHeader>
                  <AdminDataTableRow>
                    <AdminDataTableHead>Ticket</AdminDataTableHead>
                    <AdminDataTableHead>Subject</AdminDataTableHead>
                    <AdminDataTableHead>Email</AdminDataTableHead>
                    <AdminDataTableHead>Status</AdminDataTableHead>
                    <AdminDataTableHead
                      sortable
                      sorted={isSorted('createdAt') ? sortOrder : false}
                      onSort={() => toggleSort('createdAt')}
                    >
                      Created
                    </AdminDataTableHead>
                  </AdminDataTableRow>
                </AdminDataTableHeader>
                <TableBody>
                  {sortedRows.map((ticket) => (
                    <AdminDataTableRow key={ticket.id}>
                      <AdminDataTableCell className="font-mono text-xs">
                        {ticket.ticketNumber}
                      </AdminDataTableCell>
                      <AdminDataTableCell className="max-w-[200px] truncate">
                        {ticket.subject}
                      </AdminDataTableCell>
                      <AdminDataTableCell>{ticket.userEmail}</AdminDataTableCell>
                      <AdminDataTableCell>
                        <div className="flex flex-col gap-2">
                          <StatusBadge status={ticket.status} size="sm" />
                          <Select
                            value={ticket.status}
                            disabled={updatingId === ticket.id}
                            onValueChange={(v) =>
                              handleStatusChange(ticket.id, v as SupportTicket['status'])
                            }
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">In progress</SelectItem>
                              <SelectItem value="waiting_customer">Waiting on customer</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </AdminDataTableCell>
                      <AdminDataTableCell className="text-muted-foreground">
                        {formatDateTime(new Date(ticket.createdAt))}
                      </AdminDataTableCell>
                    </AdminDataTableRow>
                  ))}
                </TableBody>
              </AdminDataTable>
            </AdminDesktopOnly>

            <AdminMobileCardList>
              {sortedRows.map((ticket) => (
                <AdminMobileCard key={ticket.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold">{ticket.ticketNumber}</p>
                      <p className="truncate text-sm">{ticket.subject}</p>
                    </div>
                    <StatusBadge status={ticket.status} size="sm" />
                  </div>
                  <p className="text-xs text-muted-foreground">{ticket.userEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(ticket.createdAt))}
                  </p>
                  <Select
                    value={ticket.status}
                    disabled={updatingId === ticket.id}
                    onValueChange={(v) =>
                      handleStatusChange(ticket.id, v as SupportTicket['status'])
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="waiting_customer">Waiting on customer</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
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
    </div>
  )
}
