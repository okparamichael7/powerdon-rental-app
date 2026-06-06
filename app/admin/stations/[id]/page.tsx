"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminErrorBanner, AdminEmptyState } from "@/components/admin/admin-states"
import { AdminPageSkeleton } from "@/components/admin/admin-skeletons"
import { StatusBadge } from "@/components/volt/status-badge"
import { StationFormDialog } from "@/components/admin/hardware/station-form-dialog"
import { useHardwareAdmin } from "@/hooks/use-hardware-admin"
import { useStaffRole } from "@/hooks/use-staff-role"
import { toast } from "@/components/admin/admin-providers"
import type { AdminHardwareUnit, AdminHardwareSlot } from "@/lib/mappers/hardware-mappers"
import { formatDateTime } from "@/lib/utils"
import {
  ArrowLeft,
  Cpu,
  Copy,
  Pencil,
  QrCode,
  AlertTriangle,
} from "lucide-react"

type HardwareDetail = {
  hardware: AdminHardwareUnit
  slots: AdminHardwareSlot[]
  activeSessions: Array<{ id: string; sessionCode: string; userEmail: string; status: string; slotNumber: number }>
  recentSessions: Array<{ id: string; sessionCode: string; userEmail: string; status: string }>
  auditLog: Array<{ id: string; action: string; createdAt: string; slotNumber: number | null }>
  maintenance: Array<{ id: string; title: string; status: string; created_at: string }>
  deletionBlockers: Array<{ code: string; message: string }>
  qrUrl: string
}

const SLOT_STATUS_OPTIONS = [
  { value: "empty", label: "Empty" },
  { value: "occupied", label: "Occupied (rentable)" },
  { value: "disabled", label: "Unavailable / maintenance" },
  { value: "error", label: "Error" },
] as const

export default function StationDetailPage() {
  const params = useParams<{ id: string }>()
  const stationId = params.id
  const { isAdmin } = useStaffRole()
  const {
    loading,
    error,
    setError,
    getHardwareDetail,
    updateHardware,
    updateSlot,
    restoreHardware,
    createMaintenanceRecord,
  } = useHardwareAdmin()

  const [detail, setDetail] = useState<HardwareDetail | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [slotSaving, setSlotSaving] = useState<number | null>(null)
  const [maintTitle, setMaintTitle] = useState("")
  const [maintDescription, setMaintDescription] = useState("")
  const [maintSubmitting, setMaintSubmitting] = useState(false)

  const load = useCallback(async () => {
    const data = await getHardwareDetail(stationId)
    if (data) setDetail(data as HardwareDetail)
  }, [getHardwareDetail, stationId])

  useEffect(() => {
    load()
  }, [load])

  const handleEdit = async (
    values: import("@/components/admin/hardware/station-form-dialog").StationFormValues,
  ) => {
    const result = await updateHardware(stationId, {
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

  const handleSlotUpdate = async (
    slotNumber: number,
    patch: { label?: string; status?: string },
  ) => {
    setSlotSaving(slotNumber)
    const result = await updateSlot(stationId, slotNumber, patch)
    if (result.ok) {
      toast.success(`Slot ${slotNumber} updated`)
      await load()
    } else {
      toast.error(result.error || "Slot update failed")
    }
    setSlotSaving(null)
  }

  const copyQrUrl = async () => {
    if (!detail?.qrUrl) return
    await navigator.clipboard.writeText(detail.qrUrl)
    toast.success("QR URL copied")
  }

  if (loading && !detail) return <AdminPageSkeleton />

  if (!detail) {
    return (
      <div className="space-y-4">
        <AdminErrorBanner
          message={error || "Hardware not found"}
          onRetry={() => {
            setError(null)
            load()
          }}
        />
        <Button variant="outline" asChild>
          <Link href="/admin/stations">
            <ArrowLeft className="mr-2 size-4" />
            Back to hardware
          </Link>
        </Button>
      </div>
    )
  }

  const { hardware, slots, activeSessions, recentSessions, auditLog, deletionBlockers, qrUrl } =
    detail

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={hardware.name}
        description={hardware.location || "No location set"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/stations">
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/hardware">
                <Cpu className="mr-2 size-4" />
                Live console
              </Link>
            </Button>
            {isAdmin && hardware.archivedAt && (
              <Button
                size="sm"
                onClick={async () => {
                  const result = await restoreHardware(stationId)
                  if (result.ok) {
                    toast.success("Hardware restored")
                    await load()
                  } else {
                    toast.error(result.error || "Restore failed")
                  }
                }}
              >
                Restore
              </Button>
            )}
            {isAdmin && !hardware.archivedAt && (
              <Button size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </Button>
            )}
          </div>
        }
      />

      {error && <AdminErrorBanner message={error} onRetry={load} />}

      {hardware.archivedAt && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="size-4 text-amber-600" />
          Archived on {formatDateTime(new Date(hardware.archivedAt))}
        </div>
      )}

      {deletionBlockers.length > 0 && isAdmin && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Deletion / archive constraints</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            {deletionBlockers.map((b) => (
              <p key={b.code}>• {b.message}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Hardware metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <StatusBadge status={hardware.status as "online"} size="sm" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Identifier</p>
              <p className="font-mono text-xs">{hardware.externalId ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p>{hardware.hardwareType?.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Availability</p>
              <p>
                {hardware.availableSlots}/{hardware.totalSlots} rentable slots
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Description</p>
              <p>{hardware.description || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">QR reference</p>
              <p>{hardware.qrReference || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">External service ref</p>
              <p>{hardware.externalServiceRef || "—"}</p>
            </div>
            {hardware.notes && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p>{hardware.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-4" />
              Customer QR URL
            </CardTitle>
            <CardDescription>Encode this in QR codes for station scan flow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <code className="block break-all rounded bg-muted p-2 text-xs">{qrUrl}</code>
            <Button variant="outline" size="sm" className="w-full" onClick={copyQrUrl}>
              <Copy className="mr-2 size-4" />
              Copy URL
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Slot management</CardTitle>
          <CardDescription>
            Occupied = power bank present and rentable. Reserved slots are managed by the rental flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {slots.length === 0 ? (
            <AdminEmptyState title="No slots" description="Slots are created when hardware is provisioned." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {slots.map((slot) => (
                <div
                  key={slot.id}
                  className="space-y-3 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Slot {slot.slotNumber}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {slot.status}
                    </Badge>
                  </div>
                  {slot.status === "reserved" && (
                    <p className="text-xs text-amber-600">Reserved — checkout in progress</p>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs">Label</Label>
                    <Input
                      defaultValue={slot.label ?? ""}
                      disabled={slotSaving === slot.slotNumber}
                      onBlur={(e) => {
                        const val = e.target.value
                        if (val !== (slot.label ?? "")) {
                          handleSlotUpdate(slot.slotNumber, { label: val || undefined })
                        }
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Status</Label>
                    <Select
                      value={slot.status === "reserved" ? "reserved" : slot.status}
                      disabled={slot.status === "reserved" || slotSaving === slot.slotNumber}
                      onValueChange={(v) => {
                        if (v !== "reserved") handleSlotUpdate(slot.slotNumber, { status: v })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {slot.status === "reserved" && (
                          <SelectItem value="reserved" disabled>
                            Reserved
                          </SelectItem>
                        )}
                        {SLOT_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {slot.powerBankId && (
                    <p className="text-xs text-muted-foreground">
                      Bank: <span className="font-mono">{slot.powerBankId}</span>
                    </p>
                  )}
                  {slot.batteryLevel != null && (
                    <p className="text-xs text-muted-foreground">Battery: {slot.batteryLevel}%</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active rentals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active rentals</p>
            ) : (
              activeSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <div>
                    <p className="font-medium">{s.userEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      Slot {s.slotNumber} · {s.sessionCode}
                    </p>
                  </div>
                  <StatusBadge status={s.status as "active"} size="sm" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent rentals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rental history</p>
            ) : (
              recentSessions.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span>{s.userEmail}</span>
                  <Badge variant="secondary">{s.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maintenance records</CardTitle>
          <CardDescription>Log inspections, repairs, and operational issues</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.maintenance.length > 0 ? (
            <div className="space-y-2">
              {detail.maintenance.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded border p-2 text-sm">
                  <span>{m.title}</span>
                  <Badge variant="secondary">{m.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No maintenance records</p>
          )}
          {isAdmin && !hardware.archivedAt && (
            <form
              className="space-y-3 border-t pt-4"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!maintTitle.trim()) return
                setMaintSubmitting(true)
                const result = await createMaintenanceRecord(stationId, {
                  title: maintTitle.trim(),
                  description: maintDescription.trim() || undefined,
                })
                if (result.ok) {
                  toast.success("Maintenance record created")
                  setMaintTitle("")
                  setMaintDescription("")
                  await load()
                } else {
                  toast.error(result.error || "Failed to create record")
                }
                setMaintSubmitting(false)
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="maint-title">Title</Label>
                <Input
                  id="maint-title"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maint-desc">Description</Label>
                <Textarea
                  id="maint-desc"
                  rows={2}
                  value={maintDescription}
                  onChange={(e) => setMaintDescription(e.target.value)}
                />
              </div>
              <Button type="submit" size="sm" disabled={maintSubmitting}>
                Add maintenance record
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit history</CardTitle>
          <CardDescription>Hardware admin actions for this unit</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet</p>
          ) : (
            <div className="space-y-2">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-0"
                >
                  <span className="capitalize">{entry.action.replace(/\./g, " ")}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(new Date(entry.createdAt))}
                    {entry.slotNumber ? ` · slot ${entry.slotNumber}` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <StationFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={hardware}
        onSubmit={handleEdit}
      />
    </div>
  )
}
