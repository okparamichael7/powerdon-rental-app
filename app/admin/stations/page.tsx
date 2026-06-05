"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import Link from "next/link"
import { MapPin, Battery, Wifi, WifiOff, Zap, Clock, AlertTriangle, Cpu } from "lucide-react"
import { AdminErrorBanner, AdminEmptyState } from "@/components/admin/admin-states"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminFilterBar } from "@/components/admin/admin-filter-bar"
import { AdminStatCard, AdminStatGrid } from "@/components/admin/admin-stat-card"
import { AdminStatGridSkeleton, AdminCardGridSkeleton } from "@/components/admin/admin-skeletons"
import { AdminPaginationBar } from "@/components/admin/admin-pagination-bar"
import { StatusBadge } from "@/components/volt/status-badge"
import { useStations, useSessions } from "@/hooks/use-services"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useAdminPagination } from "@/hooks/use-admin-pagination"
import type { Station } from "@/lib/types"
import { formatDateTime } from "@/lib/utils"

const STATUS_DOT_CLASS: Record<Station["status"], string> = {
  online: "bg-emerald-500",
  offline: "bg-muted-foreground/50",
  maintenance: "bg-amber-500",
  "low-battery": "bg-red-500",
}

export default function StationsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)

  const debouncedSearch = useDebouncedValue(searchQuery)
  const { page, pageSize, setPage, setPageSize, resetPage } = useAdminPagination()
  const { data: stations, loading, error, fetchStations, refetch } = useStations()
  const { data: allSessions, fetchSessions } = useSessions()

  useEffect(() => {
    resetPage()
  }, [debouncedSearch, statusFilter, resetPage])

  useEffect(() => {
    const filters: Parameters<typeof fetchStations>[0] = {}
    if (debouncedSearch) filters.search = debouncedSearch
    if (statusFilter !== "all") filters.status = [statusFilter as Station["status"]]
    fetchStations(filters)
  }, [debouncedSearch, statusFilter, fetchStations])

  useEffect(() => {
    if (selectedStation) {
      fetchSessions({ stationId: selectedStation.id, limit: 5 })
    }
  }, [selectedStation?.id, fetchSessions])

  const filteredStations = stations || []
  const totalStations = filteredStations.length
  const paginatedStations = filteredStations.slice(
    (page - 1) * pageSize,
    page * pageSize,
  )
  const stationSessions = selectedStation
    ? (allSessions?.filter((s) => s.stationId === selectedStation.id).slice(0, 5) || [])
    : []

  const stats = {
    online: filteredStations.filter((s) => s.status === "online").length,
    offline: filteredStations.filter((s) => s.status === "offline").length,
    maintenance: filteredStations.filter((s) => s.status === "maintenance").length,
    totalSlots: filteredStations.reduce((sum, s) => sum + s.totalSlots, 0),
    availableSlots: filteredStations.reduce((sum, s) => sum + s.availableSlots, 0),
  }

  const activeFilters =
    statusFilter !== "all"
      ? [
          {
            key: "status",
            label: `Status: ${statusFilter}`,
            onRemove: () => setStatusFilter("all"),
          },
        ]
      : []

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Stations"
        description="Monitor and manage power bank stations"
        meta={
          filteredStations.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {filteredStations.length} stations
            </p>
          ) : null
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/hardware">
              <Cpu className="mr-2 size-4" aria-hidden />
              Hardware Console
            </Link>
          </Button>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={() => refetch()} />}

      {loading ? (
        <AdminStatGridSkeleton count={4} />
      ) : (
        <AdminStatGrid>
          <AdminStatCard
            label="Online"
            value={stats.online}
            icon={Wifi}
            trend="positive"
          />
          <AdminStatCard label="Offline" value={stats.offline} icon={WifiOff} />
          <AdminStatCard
            label="Maintenance"
            value={stats.maintenance}
            icon={AlertTriangle}
            trend="warning"
          />
          <AdminStatCard
            label="Available Slots"
            value={`${stats.availableSlots}/${stats.totalSlots}`}
            icon={Battery}
          />
        </AdminStatGrid>
      )}

      <AdminFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search stations…"
        activeFilters={activeFilters}
        onClearFilters={searchQuery || statusFilter !== "all" ? clearFilters : undefined}
      >
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </AdminFilterBar>

      {loading ? (
        <AdminCardGridSkeleton count={6} />
      ) : filteredStations.length === 0 ? (
        <AdminEmptyState
          title="No stations found"
          description="Stations appear when registered in the database or connected via hardware."
        />
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedStations.map((station) => (
            <div key={station.id}>
              <Card
                className="cursor-pointer transition-all hover:border-primary/20 hover:shadow-md"
                onClick={() => setSelectedStation(station)}
              >
                <CardContent className="p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`size-2 rounded-full ${STATUS_DOT_CLASS[station.status]}`}
                      />
                      <span className="font-medium text-foreground">{station.name}</span>
                    </div>
                    <StatusBadge status={station.status} size="sm" />
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="size-3.5" aria-hidden />
                      <span className="truncate">{station.location}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Battery className="size-3.5" aria-hidden />
                        <span>
                          {station.availableSlots}/{station.totalSlots} available
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex gap-1">
                      {Array.from({ length: station.totalSlots }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < station.availableSlots ? "bg-primary" : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>ID: {station.id}</span>
                    <span>Battery: {station.batteryLevel}%</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
        <AdminPaginationBar
          page={page}
          pageSize={pageSize}
          total={totalStations}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
        </>
      )}

      <AdminDrawer
        open={!!selectedStation}
        onOpenChange={(open) => !open && setSelectedStation(null)}
        size="wide"
      >
        {selectedStation && (
          <>
            <AdminDrawerHeader
              title={
                <span className="flex items-center gap-3">
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[selectedStation.status]}`}
                    aria-hidden
                  />
                  {selectedStation.name}
                </span>
              }
              description={selectedStation.location}
            />

            <AdminDrawerBody>
              <AdminDrawerStatsGrid>
                <AdminDrawerStat
                  label="Status"
                  value={<StatusBadge status={selectedStation.status} size="sm" />}
                />
                <AdminDrawerStat
                  label="Availability"
                  value={`${selectedStation.availableSlots}/${selectedStation.totalSlots}`}
                />
              </AdminDrawerStatsGrid>

              <AdminDrawerSection title="Station Info" icon={MapPin}>
                <AdminDrawerFieldList>
                  <AdminDrawerField label="Location" value={selectedStation.location} />
                  <AdminDrawerField label="Station ID" value={selectedStation.id} mono />
                </AdminDrawerFieldList>
              </AdminDrawerSection>

              <AdminDrawerSection title="Slot Status">
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: selectedStation.totalSlots }).map((_, i) => {
                    const isAvailable = i < selectedStation.availableSlots
                    return (
                      <div
                        key={i}
                        className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs ${
                          isAvailable
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-border bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Battery className="mb-1 size-4" aria-hidden />
                        <span>Slot {String(i + 1).padStart(2, "0")}</span>
                        <span className="text-[10px]">{isAvailable ? "Ready" : "In Use"}</span>
                      </div>
                    )
                  })}
                </div>
              </AdminDrawerSection>

              <AdminDrawerSection title="Recent Activity">
                {stationSessions.length > 0 ? (
                  <div className="space-y-2">
                    {stationSessions.map((session) => (
                      <AdminDrawerPanel key={session.id} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Zap className="size-4 shrink-0 text-primary" aria-hidden />
                            <span className="truncate text-sm font-medium">
                              {session.userEmail}
                            </span>
                          </div>
                          <StatusBadge status={session.status} size="sm" />
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" aria-hidden />
                            {session.durationMinutes
                              ? `${session.durationMinutes}m`
                              : "Active"}
                          </span>
                          <span>{formatDateTime(new Date(session.startTime))}</span>
                        </div>
                      </AdminDrawerPanel>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                )}
              </AdminDrawerSection>
            </AdminDrawerBody>

            <AdminDrawerFooter>
              <Button variant="outline" asChild>
                <Link href="/admin/hardware">Open in Hardware</Link>
              </Button>
            </AdminDrawerFooter>
          </>
        )}
      </AdminDrawer>
    </div>
  )
}
