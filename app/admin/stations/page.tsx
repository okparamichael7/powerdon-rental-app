"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminFilterBar } from "@/components/admin/admin-filter-bar"
import { AdminErrorBanner, AdminEmptyState } from "@/components/admin/admin-states"
import { AdminStatCard, AdminStatGrid } from "@/components/admin/admin-stat-card"
import { AdminTableSkeleton } from "@/components/admin/admin-skeletons"
import { AdminPaginationBar } from "@/components/admin/admin-pagination-bar"
import {
  AdminDataTable,
  AdminDataTableCard,
  AdminDataTableHeader,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableCell,
} from "@/components/admin/admin-data-table"
import { TableBody } from "@/components/ui/table"
import type { StationFormValues } from "@/components/admin/hardware/station-form-dialog"
import { StatusBadge } from "@/components/volt/status-badge"
import { StationFormDialog } from "@/components/admin/hardware/station-form-dialog"
import { useHardwareAdmin } from "@/hooks/use-hardware-admin"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useAdminPagination } from "@/hooks/use-admin-pagination"
import { useStaffRole } from "@/hooks/use-staff-role"
import { toast } from "@/components/admin/admin-providers"
import type { AdminHardwareUnit } from "@/lib/mappers/hardware-mappers"
import {
  Plus,
  MoreHorizontal,
  Cpu,
  Archive,
  Trash2,
  Pencil,
  ExternalLink,
  Radio,
} from "lucide-react"

export default function StationsPage() {
  const { isAdmin } = useStaffRole()
  const {
    loading,
    error,
    setError,
    listHardware,
    createHardware,
    updateHardware,
    archiveHardware,
    deleteHardware,
    restoreHardware,
  } = useHardwareAdmin()

  const [hardware, setHardware] = useState<AdminHardwareUnit[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [editing, setEditing] = useState<AdminHardwareUnit | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: "archive" | "delete"
    unit: AdminHardwareUnit
  } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const debouncedSearch = useDebouncedValue(searchQuery)
  const { page, pageSize, setPage, setPageSize, resetPage } = useAdminPagination()

  const load = useCallback(async () => {
    const data = await listHardware({
      search: debouncedSearch || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      includeArchived: showArchived,
    })
    if (data) setHardware(data)
  }, [listHardware, debouncedSearch, statusFilter, showArchived])

  useEffect(() => {
    resetPage()
  }, [debouncedSearch, statusFilter, showArchived, resetPage])

  useEffect(() => {
    load()
  }, [load])

  const paginated = hardware.slice((page - 1) * pageSize, page * pageSize)

  const stats = {
    total: hardware.length,
    online: hardware.filter((h) => h.status === "online" && !h.archivedAt).length,
    maintenance: hardware.filter((h) => h.status === "maintenance").length,
    archived: hardware.filter((h) => h.archivedAt).length,
  }

  const handleCreate = async (values: StationFormValues) => {
    const result = await createHardware({
      name: values.name,
      externalId: values.externalId,
      hardwareType: values.hardwareType,
      description: values.description || undefined,
      location: values.location || undefined,
      totalSlots: values.totalSlots,
      status: values.status,
      qrReference: values.qrReference || undefined,
      externalServiceRef: values.externalServiceRef || undefined,
      notes: values.notes || undefined,
      isEnabled: values.isEnabled,
    })
    if (result.ok) {
      toast.success("Hardware created")
      await load()
      return { ok: true }
    }
    return { ok: false, error: result.error }
  }

  const handleEdit = async (values: StationFormValues) => {
    if (!editing) return { ok: false, error: "No hardware selected" }
    const result = await updateHardware(editing.id, {
      name: values.name,
      hardwareType: values.hardwareType,
      description: values.description || undefined,
      location: values.location || undefined,
      totalSlots: values.totalSlots,
      status: values.status,
      qrReference: values.qrReference || undefined,
      externalServiceRef: values.externalServiceRef || undefined,
      notes: values.notes || undefined,
      isEnabled: values.isEnabled,
    })
    if (result.ok) {
      toast.success("Hardware updated")
      await load()
      return { ok: true }
    }
    return { ok: false, error: result.error, blockers: result.blockers }
  }

  const runConfirmAction = async () => {
    if (!confirmAction) return
    setActionLoading(true)
    if (confirmAction.type === "archive") {
      const result = await archiveHardware(confirmAction.unit.id)
      if (result.ok) {
        toast.success("Hardware archived")
        await load()
      } else {
        toast.error(result.error || "Archive failed")
      }
    } else {
      const result = await deleteHardware(confirmAction.unit.id)
      if (result.ok) {
        toast.success("Hardware removed")
        await load()
      } else {
        const msg =
          result.blockers?.map((b) => b.message).join("; ") || result.error || "Delete failed"
        toast.error(msg)
      }
    }
    setActionLoading(false)
    setConfirmAction(null)
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Hardware"
        description="Manage power bank stations, slots, and availability without using Supabase"
        meta={
          hardware.length > 0 ? (
            <p className="text-xs text-muted-foreground">{hardware.length} units</p>
          ) : null
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/hardware">
                <Cpu className="mr-2 size-4" aria-hidden />
                Live Console
              </Link>
            </Button>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => {
                  setFormMode("create")
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="mr-2 size-4" aria-hidden />
                Add hardware
              </Button>
            )}
          </div>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={() => { setError(null); load() }} />}

      <AdminStatGrid>
        <AdminStatCard label="Total units" value={stats.total} icon={Radio} />
        <AdminStatCard label="Online" value={stats.online} trend="positive" />
        <AdminStatCard label="Maintenance" value={stats.maintenance} trend="warning" />
        <AdminStatCard label="Archived" value={stats.archived} />
      </AdminStatGrid>

      <AdminFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name, location, or ID…"
        onClearFilters={
          searchQuery || statusFilter !== "all" || showArchived
            ? () => {
                setSearchQuery("")
                setStatusFilter("all")
                setShowArchived(false)
              }
            : undefined
        }
      >
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Showing archived" : "Show archived"}
        </Button>
      </AdminFilterBar>

      {loading && hardware.length === 0 ? (
        <AdminTableSkeleton rows={8} />
      ) : hardware.length === 0 ? (
        <AdminEmptyState
          title="No hardware units"
          description="Add your first station here, or wait for hardware to auto-register on connect."
          action={
            isAdmin ? (
              <Button
                size="sm"
                onClick={() => {
                  setFormMode("create")
                  setFormOpen(true)
                }}
              >
                <Plus className="mr-2 size-4" />
                Add hardware
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <AdminDataTableCard>
            <AdminDataTable>
              <AdminDataTableHeader>
                <AdminDataTableRow>
                  <AdminDataTableHead>Name</AdminDataTableHead>
                  <AdminDataTableHead>Identifier</AdminDataTableHead>
                  <AdminDataTableHead>Location</AdminDataTableHead>
                  <AdminDataTableHead>Status</AdminDataTableHead>
                  <AdminDataTableHead>Slots</AdminDataTableHead>
                  <AdminDataTableHead>Type</AdminDataTableHead>
                  <AdminDataTableHead className="text-right">Actions</AdminDataTableHead>
                </AdminDataTableRow>
              </AdminDataTableHeader>
              <TableBody>
                {paginated.map((unit) => (
                  <AdminDataTableRow key={unit.id}>
                    <AdminDataTableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/stations/${unit.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {unit.name}
                        </Link>
                        {unit.archivedAt && (
                          <Badge variant="secondary" className="text-[10px]">
                            Archived
                          </Badge>
                        )}
                      </div>
                    </AdminDataTableCell>
                    <AdminDataTableCell className="font-mono text-xs text-muted-foreground">
                      {unit.externalId ?? "—"}
                    </AdminDataTableCell>
                    <AdminDataTableCell className="max-w-[180px] truncate text-sm">
                      {unit.location || "—"}
                    </AdminDataTableCell>
                    <AdminDataTableCell>
                      <StatusBadge status={unit.status as "online"} size="sm" />
                    </AdminDataTableCell>
                    <AdminDataTableCell className="text-sm">
                      {unit.availableSlots}/{unit.totalSlots}
                    </AdminDataTableCell>
                    <AdminDataTableCell className="text-xs text-muted-foreground">
                      {unit.hardwareType?.replace(/_/g, " ") ?? "—"}
                    </AdminDataTableCell>
                    <AdminDataTableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/stations/${unit.id}`}>
                              <ExternalLink className="mr-2 size-4" />
                              View detail
                            </Link>
                          </DropdownMenuItem>
                          {isAdmin && !unit.archivedAt && (
                            <DropdownMenuItem
                              onClick={() => {
                                setFormMode("edit")
                                setEditing(unit)
                                setFormOpen(true)
                              }}
                            >
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {isAdmin && unit.archivedAt && (
                            <DropdownMenuItem
                              onClick={async () => {
                                const result = await restoreHardware(unit.id)
                                if (result.ok) {
                                  toast.success("Hardware restored")
                                  await load()
                                } else {
                                  toast.error(result.error || "Restore failed")
                                }
                              }}
                            >
                              Restore
                            </DropdownMenuItem>
                          )}
                          {isAdmin && !unit.archivedAt && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  setConfirmAction({ type: "archive", unit })
                                }
                              >
                                <Archive className="mr-2 size-4" />
                                Archive
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  setConfirmAction({ type: "delete", unit })
                                }
                              >
                                <Trash2 className="mr-2 size-4" />
                                Remove
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </AdminDataTableCell>
                  </AdminDataTableRow>
                ))}
              </TableBody>
            </AdminDataTable>
          </AdminDataTableCard>
          <AdminPaginationBar
            page={page}
            pageSize={pageSize}
            total={hardware.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      <StationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initial={editing}
        onSubmit={formMode === "create" ? handleCreate : handleEdit}
      />

      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction?.type === "archive" ? "Archive hardware?" : "Remove hardware?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "archive"
                ? `Archive "${confirmAction?.unit.name}"? It will be disabled and hidden from normal operations. Historical data is preserved.`
                : `Permanently remove "${confirmAction?.unit.name}"? This is only allowed when there are no active or historical rentals. Prefer archive when in doubt.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.type === "delete" ? "destructive" : "default"}
              onClick={runConfirmAction}
              disabled={actionLoading}
            >
              {confirmAction?.type === "archive" ? "Archive" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
