'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSupportTickets } from '@/hooks/use-services'
import { supportService } from '@/lib/services'
import { isSuccessResponse } from '@/lib/api/client'
import { AdminErrorBanner, AdminEmptyState } from '@/components/admin/admin-states'
import { formatDateTime } from '@/lib/utils'
import type { SupportTicket } from '@/lib/api/types'
import { RefreshCw } from 'lucide-react'

export default function SupportPage() {
  const { data: tickets, loading, error, fetchTickets, refetch } = useSupportTickets()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetchTickets(
      statusFilter !== 'all'
        ? { status: [statusFilter as SupportTicket['status']] }
        : undefined,
    )
  }, [statusFilter, fetchTickets])

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">Customer support cases from the database</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && <AdminErrorBanner message={error} onRetry={() => refetch()} />}

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="waiting_customer">Waiting on customer</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          {loading && !rows.length ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <AdminEmptyState title="No support tickets" description="Tickets appear when customers submit the support form." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Ticket</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Subject</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-border/50">
                      <td className="px-4 py-3 font-mono text-xs">{ticket.ticketNumber}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate">{ticket.subject}</td>
                      <td className="px-4 py-3">{ticket.userEmail}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={ticket.status}
                          disabled={updatingId === ticket.id}
                          onValueChange={(v) => handleStatusChange(ticket.id, v as SupportTicket['status'])}
                        >
                          <SelectTrigger className="h-8 w-[130px]">
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
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTime(new Date(ticket.createdAt))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{rows.length} ticket{rows.length === 1 ? '' : 's'} loaded</p>
    </div>
  )
}
