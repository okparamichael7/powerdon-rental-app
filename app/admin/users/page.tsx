'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Search, Download, Users } from 'lucide-react'
import { useUsers } from '@/hooks/use-services'
import { downloadCsv } from '@/lib/admin/export-csv'
import { AdminErrorBanner, AdminEmptyState } from '@/components/admin/admin-states'
import { formatDateTime } from '@/lib/utils'

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const { data: users, loading, error, fetchUsers, refetch } = useUsers()

  useEffect(() => {
    fetchUsers(searchQuery ? { search: searchQuery } : undefined)
  }, [searchQuery, fetchUsers])

  const rows = users ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">Registered renters from Supabase</p>
        </div>
        <Button
          variant="outline"
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
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {error && <AdminErrorBanner message={error} onRetry={() => refetch()} />}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by email or name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <AdminEmptyState title="No customers yet" description="Users are created when someone rents a power bank." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Rentals</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => (
                    <tr key={user.id} className="border-b border-border/50">
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{user.totalRentals}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateTime(new Date(user.createdAt))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <Users className="h-3 w-3" />
        {rows.length} customer{rows.length === 1 ? '' : 's'} loaded from database
      </p>
    </div>
  )
}
