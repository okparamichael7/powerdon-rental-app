"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { TableBody } from "@/components/ui/table"
import {
  AdminDrawer,
  AdminDrawerHeader,
  AdminDrawerBody,
  AdminDrawerFooter,
  AdminDrawerSection,
  AdminDrawerFieldList,
  AdminDrawerField,
  AdminDrawerStatsGrid,
  AdminDrawerStat,
  AdminDrawerPanel,
} from "@/components/admin/admin-drawer"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminFilterBar, AdminFilterToggleGroup } from "@/components/admin/admin-filter-bar"
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
import { StatusBadge, ConsentBadge } from "@/components/volt/status-badge"
import { Users, Mail, Download, UserCheck, Clock, Zap } from "lucide-react"
import { useUsers, useSessions } from "@/hooks/use-services"
import { downloadCsv } from "@/lib/admin/export-csv"
import { AdminErrorBanner } from "@/components/admin/admin-states"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useAdminPagination } from "@/hooks/use-admin-pagination"
import { useTableSort } from "@/hooks/use-table-sort"
import { formatDateTime } from "@/lib/utils"
import type { User } from "@/lib/types"

const CONSENT_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "marketing", label: "Marketing" },
  { value: "no-marketing", label: "No Marketing" },
]

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [consentFilter, setConsentFilter] = useState<string>("all")
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectedLead, setSelectedLead] = useState<User | null>(null)

  const debouncedSearch = useDebouncedValue(searchQuery)
  const { page, pageSize, setPage, setPageSize, resetPage, paginationParams } = useAdminPagination()
  const { data: users, loading: usersLoading, error: usersError, total, fetchUsers, refetch } = useUsers()
  const { data: allSessions, fetchSessions } = useSessions()

  useEffect(() => {
    resetPage()
  }, [debouncedSearch, consentFilter, resetPage])

  useEffect(() => {
    const filters: Parameters<typeof fetchUsers>[0] = {
      ...paginationParams,
    }
    if (debouncedSearch) filters.search = debouncedSearch
    if (consentFilter === "marketing") filters.marketingConsent = true
    if (consentFilter === "no-marketing") filters.marketingConsent = false
    fetchUsers(filters)
  }, [debouncedSearch, consentFilter, paginationParams, fetchUsers])

  useEffect(() => {
    if (selectedLead) {
      fetchSessions({ search: selectedLead.email })
    }
  }, [selectedLead?.id, fetchSessions])

  const filteredLeads = users || []
  const { sorted: sortedLeads, sortOrder, toggleSort, isSorted } = useTableSort(
    filteredLeads,
    "createdAt",
    "desc",
  )
  const leadSessions = selectedLead
    ? (allSessions?.filter((s) => s.userEmail === selectedLead.email) || [])
    : []

  const stats = {
    total,
    withMarketing: filteredLeads.filter((l) => l.marketingConsent).length,
    thisWeek: filteredLeads.filter((l) => {
      const date = new Date(l.createdAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return date > weekAgo
    }).length,
    activeRenters: filteredLeads.filter((l) => l.totalRentals > 1).length,
  }

  const toggleSelectLead = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    )
  }

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(filteredLeads.map((l) => l.id))
    }
  }

  const handleExportAll = () => {
    downloadCsv(
      "powerdon-leads.csv",
      ["email", "name", "marketingConsent", "totalRentals", "createdAt"],
      filteredLeads.map((l) => [
        l.email,
        l.name ?? "",
        l.marketingConsent,
        l.totalRentals,
        new Date(l.createdAt).toISOString(),
      ]),
    )
  }

  const handleExportSelected = () => {
    const selected = filteredLeads.filter((l) => selectedLeads.includes(l.id))
    downloadCsv(
      "powerdon-leads-selected.csv",
      ["email", "name", "marketingConsent", "totalRentals", "createdAt"],
      selected.map((l) => [
        l.email,
        l.name ?? "",
        l.marketingConsent,
        l.totalRentals,
        new Date(l.createdAt).toISOString(),
      ]),
    )
  }

  const activeFilters =
    consentFilter !== "all"
      ? [
          {
            key: "consent",
            label:
              consentFilter === "marketing" ? "Marketing consent" : "No marketing",
            onRemove: () => setConsentFilter("all"),
          },
        ]
      : []

  const clearFilters = () => {
    setSearchQuery("")
    setConsentFilter("all")
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Leads & CRM"
        description="Manage captured user data and consent"
        meta={
          total > 0 ? (
            <p className="text-xs text-muted-foreground">{total} leads</p>
          ) : null
        }
        actions={
          <>
            {selectedLeads.length > 0 ? (
              <Button variant="default" size="sm" onClick={handleExportSelected}>
                <Download className="mr-2 size-4" aria-hidden />
                Export selected ({selectedLeads.length})
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={!filteredLeads.length}
              onClick={handleExportAll}
            >
              <Download className="mr-2 size-4" aria-hidden />
              Export
            </Button>
          </>
        }
      />

      {usersError && <AdminErrorBanner message={usersError} onRetry={() => refetch()} />}

      <AdminStatGrid>
        <AdminStatCard label="Total Leads" value={stats.total} icon={Users} />
        <AdminStatCard
          label="Marketing Consent"
          value={stats.withMarketing}
          icon={UserCheck}
          trend="positive"
        />
        <AdminStatCard label="This Week" value={stats.thisWeek} icon={Clock} />
        <AdminStatCard label="Repeat Renters" value={stats.activeRenters} icon={Zap} trend="warning" />
      </AdminStatGrid>

      <AdminFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by email or name…"
        activeFilters={activeFilters}
        onClearFilters={searchQuery || consentFilter !== "all" ? clearFilters : undefined}
      >
        <AdminFilterToggleGroup
          value={consentFilter}
          onChange={setConsentFilter}
          options={CONSENT_FILTER_OPTIONS}
        />
      </AdminFilterBar>

      <AdminDataTableCard>
        {usersLoading ? (
          <>
            <AdminDesktopOnly>
              <AdminTableSkeleton rows={pageSize} columns={7} />
            </AdminDesktopOnly>
            <AdminCardListSkeleton count={5} />
          </>
        ) : filteredLeads.length === 0 ? (
          <AdminDataTableEmpty title="No leads found" />
        ) : (
          <>
            <AdminDesktopOnly>
              <AdminDataTable>
                <AdminDataTableHeader>
                  <AdminDataTableRow>
                    <AdminDataTableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          selectedLeads.length === filteredLeads.length &&
                          filteredLeads.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </AdminDataTableHead>
                    <AdminDataTableHead>Email</AdminDataTableHead>
                    <AdminDataTableHead>Name</AdminDataTableHead>
                    <AdminDataTableHead>Rentals</AdminDataTableHead>
                    <AdminDataTableHead>Total Spent</AdminDataTableHead>
                    <AdminDataTableHead>Marketing</AdminDataTableHead>
                    <AdminDataTableHead
                      sortable
                      sorted={isSorted("createdAt") ? sortOrder : false}
                      onSort={() => toggleSort("createdAt")}
                    >
                      Created
                    </AdminDataTableHead>
                  </AdminDataTableRow>
                </AdminDataTableHeader>
                <TableBody>
                  {sortedLeads.map((lead) => (
                    <AdminDataTableRow
                      key={lead.id}
                      onClick={() => setSelectedLead(lead)}
                    >
                      <AdminDataTableCell>
                        <span onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedLeads.includes(lead.id)}
                            onCheckedChange={() => toggleSelectLead(lead.id)}
                          />
                        </span>
                      </AdminDataTableCell>
                      <AdminDataTableCell className="font-medium">
                        {lead.email}
                      </AdminDataTableCell>
                      <AdminDataTableCell className="text-muted-foreground">
                        {lead.name || "—"}
                      </AdminDataTableCell>
                      <AdminDataTableCell>
                        <Badge variant="secondary">{lead.totalRentals}</Badge>
                      </AdminDataTableCell>
                      <AdminDataTableCell className="text-muted-foreground">
                        €{lead.totalSpent.toFixed(2)}
                      </AdminDataTableCell>
                      <AdminDataTableCell>
                        <ConsentBadge optedIn={lead.marketingConsent} />
                      </AdminDataTableCell>
                      <AdminDataTableCell className="text-muted-foreground">
                        {formatDateTime(new Date(lead.createdAt))}
                      </AdminDataTableCell>
                    </AdminDataTableRow>
                  ))}
                </TableBody>
              </AdminDataTable>
            </AdminDesktopOnly>

            <AdminMobileCardList>
              {sortedLeads.map((lead) => (
                <AdminMobileCard key={lead.id} onClick={() => setSelectedLead(lead)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={() => toggleSelectLead(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div>
                        <p className="font-medium text-foreground">{lead.email}</p>
                        {lead.name ? (
                          <p className="text-sm text-muted-foreground">{lead.name}</p>
                        ) : null}
                      </div>
                    </div>
                    <ConsentBadge optedIn={lead.marketingConsent} />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Rentals</p>
                      <p className="font-medium">{lead.totalRentals}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Spent</p>
                      <p className="font-medium">€{lead.totalSpent.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p>{formatDateTime(new Date(lead.createdAt))}</p>
                    </div>
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

      <AdminDrawer
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
      >
        {selectedLead && (
          <>
            <AdminDrawerHeader
              title={selectedLead.email}
              description={
                selectedLead.name
                  ? `${selectedLead.name} · Lead profile`
                  : "Lead profile"
              }
            />

            <AdminDrawerBody>
              <AdminDrawerSection title="Profile" icon={Users}>
                <AdminDrawerFieldList>
                  {selectedLead.name && (
                    <AdminDrawerField label="Name" value={selectedLead.name} />
                  )}
                  <AdminDrawerField label="Email" value={selectedLead.email} />
                  <AdminDrawerField
                    label="Joined"
                    value={formatDateTime(new Date(selectedLead.createdAt))}
                  />
                </AdminDrawerFieldList>
              </AdminDrawerSection>

              <AdminDrawerStatsGrid>
                <AdminDrawerStat label="Total Rentals" value={selectedLead.totalRentals} />
                <AdminDrawerStat
                  label="Total Spent"
                  value={`€${selectedLead.totalSpent.toFixed(2)}`}
                />
              </AdminDrawerStatsGrid>

              <AdminDrawerSection title="Consent & Preferences">
                <AdminDrawerFieldList>
                  <AdminDrawerField
                    label="Account created"
                    value={formatDateTime(new Date(selectedLead.createdAt))}
                  />
                  <AdminDrawerField
                    label="Marketing emails"
                    value={<ConsentBadge optedIn={selectedLead.marketingConsent} />}
                  />
                </AdminDrawerFieldList>
              </AdminDrawerSection>

              <AdminDrawerSection title="Rental History">
                {leadSessions.length > 0 ? (
                  <div className="space-y-2">
                    {leadSessions.map((session) => (
                      <AdminDrawerPanel key={session.id} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{session.stationName}</span>
                          <StatusBadge status={session.status} size="sm" />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {session.durationMinutes
                              ? `${session.durationMinutes}m`
                              : "Active"}
                          </span>
                          <span>€{session.amountCharged.toFixed(2)}</span>
                          <span>{formatDateTime(new Date(session.startTime))}</span>
                        </div>
                      </AdminDrawerPanel>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No rental history</p>
                )}
              </AdminDrawerSection>
            </AdminDrawerBody>

            {selectedLead.email && (
              <AdminDrawerFooter>
                <Button variant="outline" className="w-full sm:w-auto" asChild>
                  <a href={`mailto:${selectedLead.email}`}>
                    <Mail className="mr-2 size-4" aria-hidden />
                    Contact via email
                  </a>
                </Button>
              </AdminDrawerFooter>
            )}
          </>
        )}
      </AdminDrawer>
    </div>
  )
}
