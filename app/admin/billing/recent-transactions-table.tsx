'use client'

import { TableBody } from '@/components/ui/table'
import { formatCurrency } from '@/lib/stripe/types'
import { StatusBadge } from '@/components/volt/status-badge'
import {
  AdminDataTable,
  AdminDataTableHeader,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableCell,
  AdminDataTableEmpty,
} from '@/components/admin/admin-data-table'
import { useTableSort } from '@/hooks/use-table-sort'

interface Transaction {
  id: string
  sessionCode: string
  customerEmail: string
  amount: number
  status: string
  type: string
  createdAt: string
  stationName?: string
}

interface RecentTransactionsTableProps {
  transactions: Transaction[]
}

const TYPE_LABELS: Record<string, string> = {
  rental_deposit: 'Deposit',
  rental_charge: 'Rental',
  lost_device: 'Lost Device',
}

export function RecentTransactionsTable({ transactions }: RecentTransactionsTableProps) {
  const rows = transactions.map((tx) => ({
    ...tx,
    createdAtSort: tx.createdAt,
  }))

  const { sorted, sortField, sortOrder, toggleSort, isSorted } = useTableSort(
    rows,
    'createdAtSort',
    'desc',
  )

  if (transactions.length === 0) {
    return (
      <AdminDataTableEmpty
        title="No transactions found"
        description="Payment activity will appear here once rentals are processed."
      />
    )
  }

  return (
    <AdminDataTable>
      <AdminDataTableHeader>
        <AdminDataTableRow>
          <AdminDataTableHead>Session</AdminDataTableHead>
          <AdminDataTableHead>Customer</AdminDataTableHead>
          <AdminDataTableHead
            sortable
            sorted={isSorted('amount') ? sortOrder : false}
            onSort={() => toggleSort('amount')}
          >
            Amount
          </AdminDataTableHead>
          <AdminDataTableHead>Status</AdminDataTableHead>
          <AdminDataTableHead>Type</AdminDataTableHead>
          <AdminDataTableHead
            sortable
            sorted={isSorted('createdAtSort') ? sortOrder : false}
            onSort={() => toggleSort('createdAtSort')}
          >
            Date
          </AdminDataTableHead>
        </AdminDataTableRow>
      </AdminDataTableHeader>
      <TableBody>
        {sorted.map((tx) => (
          <AdminDataTableRow key={tx.id}>
            <AdminDataTableCell>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{tx.sessionCode}</code>
            </AdminDataTableCell>
            <AdminDataTableCell>
              <span className="inline-block max-w-[200px] truncate text-muted-foreground">
                {tx.customerEmail}
              </span>
            </AdminDataTableCell>
            <AdminDataTableCell className="font-medium tabular-nums">
              {formatCurrency(tx.amount)}
            </AdminDataTableCell>
            <AdminDataTableCell>
              <StatusBadge status={tx.status} size="sm" />
            </AdminDataTableCell>
            <AdminDataTableCell>
              <span className="text-xs text-muted-foreground">
                {TYPE_LABELS[tx.type] ?? tx.type}
              </span>
            </AdminDataTableCell>
            <AdminDataTableCell className="text-muted-foreground">
              {new Date(tx.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </AdminDataTableCell>
          </AdminDataTableRow>
        ))}
      </TableBody>
    </AdminDataTable>
  )
}
