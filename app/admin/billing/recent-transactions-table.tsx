'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/stripe/types'
import { Badge } from '@/components/ui/badge'

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

export function RecentTransactionsTable({ transactions }: RecentTransactionsTableProps) {
  const [sortField, setSortField] = useState<'createdAt' | 'amount'>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const sortedTransactions = [...transactions].sort((a, b) => {
    if (sortField === 'createdAt') {
      return sortDir === 'desc'
        ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    }
    return sortDir === 'desc' ? b.amount - a.amount : a.amount - b.amount
  })

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      succeeded: { variant: 'default', label: 'Captured' },
      requires_capture: { variant: 'secondary', label: 'Authorized' },
      processing: { variant: 'outline', label: 'Processing' },
      canceled: { variant: 'outline', label: 'Canceled' },
      requires_payment_method: { variant: 'destructive', label: 'Failed' },
    }
    const config = variants[status] || { variant: 'outline' as const, label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      rental_deposit: 'Deposit',
      rental_charge: 'Rental',
      lost_device: 'Lost Device',
    }
    return (
      <span className="text-xs text-muted-foreground">
        {labels[type] || type}
      </span>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-muted-foreground">
        No transactions found
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="pb-3 text-left font-medium">Session</th>
            <th className="pb-3 text-left font-medium">Customer</th>
            <th
              className="pb-3 text-left font-medium cursor-pointer hover:text-primary"
              onClick={() => {
                if (sortField === 'amount') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                else { setSortField('amount'); setSortDir('desc') }
              }}
            >
              Amount {sortField === 'amount' && (sortDir === 'desc' ? '↓' : '↑')}
            </th>
            <th className="pb-3 text-left font-medium">Status</th>
            <th className="pb-3 text-left font-medium">Type</th>
            <th
              className="pb-3 text-left font-medium cursor-pointer hover:text-primary"
              onClick={() => {
                if (sortField === 'createdAt') setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                else { setSortField('createdAt'); setSortDir('desc') }
              }}
            >
              Date {sortField === 'createdAt' && (sortDir === 'desc' ? '↓' : '↑')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTransactions.map((tx) => (
            <tr key={tx.id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="py-3">
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {tx.sessionCode}
                </code>
              </td>
              <td className="py-3">
                <span className="text-muted-foreground truncate max-w-[200px] inline-block">
                  {tx.customerEmail}
                </span>
              </td>
              <td className="py-3 font-medium">
                {formatCurrency(tx.amount)}
              </td>
              <td className="py-3">
                {getStatusBadge(tx.status)}
              </td>
              <td className="py-3">
                {getTypeBadge(tx.type)}
              </td>
              <td className="py-3 text-muted-foreground">
                {new Date(tx.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
