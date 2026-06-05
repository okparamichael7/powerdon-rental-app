"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableBody } from "@/components/ui/table"
import { Gift, Ticket, CheckCircle, Clock, Download, Copy, Check } from "lucide-react"
import { useRewards, useCampaigns } from "@/hooks/use-services"
import { downloadCsv } from "@/lib/admin/export-csv"
import { AdminErrorBanner } from "@/components/admin/admin-states"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminFilterBar } from "@/components/admin/admin-filter-bar"
import { AdminStatCard, AdminStatGrid } from "@/components/admin/admin-stat-card"
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
} from "@/components/admin/admin-data-table"
import { AdminPaginationBar } from "@/components/admin/admin-pagination-bar"
import { AdminTableSkeleton, AdminCardListSkeleton } from "@/components/admin/admin-skeletons"
import { StatusBadge } from "@/components/volt/status-badge"
import { toast } from "@/components/admin/admin-providers"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useAdminPagination } from "@/hooks/use-admin-pagination"
import { useTableSort } from "@/hooks/use-table-sort"
import { formatDateTime } from "@/lib/utils"
import type { Reward } from "@/lib/types"

export default function RewardsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [campaignFilter, setCampaignFilter] = useState<string>("all")
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const debouncedSearch = useDebouncedValue(searchQuery)
  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = useAdminPagination()
  const { data: rewards, loading: rewardsLoading, error: rewardsError, total, fetchRewards, refetch } = useRewards()
  const { data: campaigns, loading: campaignsLoading, fetchCampaigns } = useCampaigns()

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  useEffect(() => {
    resetPage()
  }, [debouncedSearch, statusFilter, campaignFilter, resetPage])

  useEffect(() => {
    const filters: Parameters<typeof fetchRewards>[0] = {
      ...paginationParams,
    }
    if (debouncedSearch) filters.search = debouncedSearch
    if (statusFilter !== "all") filters.status = [statusFilter as Reward["status"]]
    if (campaignFilter !== "all") filters.campaignId = campaignFilter
    fetchRewards(filters)
  }, [debouncedSearch, statusFilter, campaignFilter, paginationParams, fetchRewards])

  const filteredRewards = rewards || []
  const { sorted: sortedRewards, sortOrder, toggleSort, isSorted } = useTableSort(
    filteredRewards,
    "issuedAt",
    "desc",
  )
  const loading = rewardsLoading || campaignsLoading

  const stats = {
    total: total,
    issued: filteredRewards.filter((r) => r.status === "issued").length,
    redeemed: filteredRewards.filter((r) => r.status === "redeemed").length,
    expired: filteredRewards.filter((r) => r.status === "expired").length,
    totalValue: filteredRewards.reduce((sum, r) => sum + r.value, 0),
    redeemedValue: filteredRewards
      .filter((r) => r.status === "redeemed")
      .reduce((sum, r) => sum + r.value, 0),
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success("Code copied to clipboard")
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const activeFilters = [
    ...(statusFilter !== "all"
      ? [
          {
            key: "status",
            label: `Status: ${statusFilter}`,
            onRemove: () => setStatusFilter("all"),
          },
        ]
      : []),
    ...(campaignFilter !== "all"
      ? [
          {
            key: "campaign",
            label: `Campaign: ${campaigns?.find((c) => c.id === campaignFilter)?.name ?? campaignFilter}`,
            onRemove: () => setCampaignFilter("all"),
          },
        ]
      : []),
  ]

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setCampaignFilter("all")
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Rewards & Vouchers"
        description="Track issued vouchers and redemptions"
        meta={
          total > 0 ? (
            <p className="text-xs text-muted-foreground">{total} rewards</p>
          ) : null
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={!filteredRewards.length}
            onClick={() =>
              downloadCsv(
                "powerdon-rewards.csv",
                ["code", "email", "status", "value", "campaign", "issuedAt"],
                filteredRewards.map((r) => [
                  r.code,
                  r.userEmail,
                  r.status,
                  r.value,
                  r.campaignName ?? "",
                  r.issuedAt ? new Date(r.issuedAt).toISOString() : "",
                ]),
              )
            }
          >
            <Download className="mr-2 size-4" aria-hidden />
            Export CSV
          </Button>
        }
      />

      {rewardsError && <AdminErrorBanner message={rewardsError} onRetry={() => refetch()} />}

      <AdminStatGrid>
        <AdminStatCard label="Total Issued" value={stats.total} icon={Gift} />
        <AdminStatCard
          label="Redeemed"
          value={stats.redeemed}
          icon={CheckCircle}
          trend="positive"
        />
        <AdminStatCard label="Pending" value={stats.issued} icon={Clock} />
        <AdminStatCard
          label="Value Redeemed"
          value={`€${stats.redeemedValue}`}
          icon={Ticket}
          trend="warning"
        />
      </AdminStatGrid>

      <AdminFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by code or email…"
        activeFilters={activeFilters}
        onClearFilters={
          searchQuery || statusFilter !== "all" || campaignFilter !== "all"
            ? clearFilters
            : undefined
        }
      >
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="redeemed">Redeemed</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Campaign" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {(campaigns || []).map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AdminFilterBar>

      <AdminDataTableCard>
        {loading ? (
          <>
            <AdminDesktopOnly>
              <AdminTableSkeleton rows={pageSize} columns={8} />
            </AdminDesktopOnly>
            <AdminCardListSkeleton count={5} />
          </>
        ) : filteredRewards.length === 0 ? (
          <AdminDataTableEmpty title="No rewards found" />
        ) : (
          <>
            <AdminDesktopOnly>
              <AdminDataTable>
                <AdminDataTableHeader>
                  <AdminDataTableRow>
                    <AdminDataTableHead>Code</AdminDataTableHead>
                    <AdminDataTableHead>User</AdminDataTableHead>
                    <AdminDataTableHead>Campaign</AdminDataTableHead>
                    <AdminDataTableHead>Value</AdminDataTableHead>
                    <AdminDataTableHead
                      sortable
                      sorted={isSorted("issuedAt") ? sortOrder : false}
                      onSort={() => toggleSort("issuedAt")}
                    >
                      Issued
                    </AdminDataTableHead>
                    <AdminDataTableHead>Expires</AdminDataTableHead>
                    <AdminDataTableHead>Status</AdminDataTableHead>
                    <AdminDataTableHead className="w-[50px]">
                      <span className="sr-only">Copy</span>
                    </AdminDataTableHead>
                  </AdminDataTableRow>
                </AdminDataTableHeader>
                <TableBody>
                  {sortedRewards.map((reward) => {
                    const campaign = campaigns?.find((c) => c.id === reward.campaignId)
                    return (
                      <AdminDataTableRow key={reward.id}>
                        <AdminDataTableCell>
                          <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                            {reward.code}
                          </code>
                        </AdminDataTableCell>
                        <AdminDataTableCell className="text-muted-foreground">
                          {reward.userEmail}
                        </AdminDataTableCell>
                        <AdminDataTableCell>
                          {campaign?.name || reward.campaignName}
                        </AdminDataTableCell>
                        <AdminDataTableCell className="font-medium">
                          €{reward.value}
                        </AdminDataTableCell>
                        <AdminDataTableCell className="text-muted-foreground">
                          {formatDateTime(new Date(reward.issuedAt))}
                        </AdminDataTableCell>
                        <AdminDataTableCell className="text-muted-foreground">
                          {formatDateTime(new Date(reward.expiresAt))}
                        </AdminDataTableCell>
                        <AdminDataTableCell>
                          <StatusBadge status={reward.status} size="sm" />
                        </AdminDataTableCell>
                        <AdminDataTableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleCopyCode(reward.code)}
                          >
                            {copiedCode === reward.code ? (
                              <Check className="size-4 text-emerald-600" />
                            ) : (
                              <Copy className="size-4" />
                            )}
                          </Button>
                        </AdminDataTableCell>
                      </AdminDataTableRow>
                    )
                  })}
                </TableBody>
              </AdminDataTable>
            </AdminDesktopOnly>

            <AdminMobileCardList>
              {sortedRewards.map((reward) => {
                const campaign = campaigns?.find((c) => c.id === reward.campaignId)
                return (
                  <AdminMobileCard key={reward.id}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <code className="rounded bg-muted px-2 py-1 font-mono text-sm">
                            {reward.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            onClick={() => handleCopyCode(reward.code)}
                          >
                            {copiedCode === reward.code ? (
                              <Check className="size-3 text-emerald-600" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{reward.userEmail}</p>
                      </div>
                      <StatusBadge status={reward.status} size="sm" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Value</p>
                        <p className="font-medium">€{reward.value}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Campaign</p>
                        <p className="font-medium">{campaign?.name || reward.campaignName}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Issued</p>
                        <p>{formatDateTime(new Date(reward.issuedAt))}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Expires</p>
                        <p>{formatDateTime(new Date(reward.expiresAt))}</p>
                      </div>
                    </div>
                  </AdminMobileCard>
                )
              })}
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
