"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import {
  AdminDrawer,
  AdminDrawerHeader,
  AdminDrawerBody,
  AdminDrawerFooter,
  AdminDrawerSection,
  AdminDrawerFieldList,
  AdminDrawerField,
  AdminDrawerPanel,
} from "@/components/admin/admin-drawer"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { AdminStatCard, AdminStatGrid } from "@/components/admin/admin-stat-card"
import { AdminFilterBar } from "@/components/admin/admin-filter-bar"
import { AdminErrorBanner, AdminEmptyState } from "@/components/admin/admin-states"
import { AdminCardGridSkeleton } from "@/components/admin/admin-skeletons"
import { AdminPaginationBar } from "@/components/admin/admin-pagination-bar"
import { useAdminPagination } from "@/hooks/use-admin-pagination"
import { StatusBadge } from "@/components/volt/status-badge"
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  RefreshCw,
  Wifi,
  WifiOff,
  Battery,
  BatteryCharging,
  Signal,
  MoreVertical,
  Cpu,
  Power,
  LogOut,
  RotateCcw,
  Terminal,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react"
import useSWR, { mutate } from "swr"

// Types for hardware API responses
interface HardwareStation {
  stationId: string
  productSn: string
  isOnline: boolean
  connectedAt: string | null
  lastHeartbeat: string | null
  lastInventoryUpdate: string | null
  signalStrength: number
  iccid: string | null
  firmwareVersion: string | null
  availableSlots: number
  inventory: {
    slotNumber: number
    terminalId: string
    batteryLevel: number
  }[]
}

interface CommandResult {
  success: boolean
  data?: unknown
  error?: string
}

// SWR fetcher
const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function HardwarePage() {
  const [searchQuery, setSearchQuery] = useState("")
  const { page, pageSize, setPage, setPageSize, resetPage } = useAdminPagination()
  const [selectedStation, setSelectedStation] = useState<HardwareStation | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [commandStatus, setCommandStatus] = useState<{ type: 'success' | 'error' | 'pending'; message: string } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => Promise<void>
    variant: 'default' | 'destructive'
  } | null>(null)

  // Fetch connected stations
  const { data: stationsResponse, error: stationsError, isLoading } = useSWR(
    '/api/stations',
    fetcher,
    { refreshInterval: 5000 } // Auto-refresh every 5 seconds
  )

  const stations: HardwareStation[] = stationsResponse?.success ? stationsResponse.data : []

  const { data: eventsResponse } = useSWR(
    selectedStation
      ? `/api/admin/hardware/events?stationId=${encodeURIComponent(selectedStation.stationId)}&limit=30`
      : null,
    fetcher,
    { refreshInterval: 10000 }
  )
  const hardwareEvents: {
    id: string
    event_type: string
    direction: string
    created_at: string
    error_message?: string | null
  }[] = eventsResponse?.success ? eventsResponse.data : []
  const filteredStations = stations.filter(s => 
    s.stationId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.productSn.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const paginatedStations = filteredStations.slice(
    (page - 1) * pageSize,
    page * pageSize,
  )

  useEffect(() => {
    resetPage()
  }, [searchQuery, resetPage])

  const activeFilters = searchQuery
    ? [{ key: 'search', label: `Search: "${searchQuery}"`, onRemove: () => setSearchQuery('') }]
    : []

  // Calculate stats
  const stats = {
    totalConnected: stations.length,
    online: stations.filter(s => s.isOnline).length,
    offline: stations.filter(s => !s.isOnline).length,
    totalPowerBanks: stations.reduce((sum, s) => sum + s.availableSlots, 0),
  }

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await mutate('/api/stations')
    setIsRefreshing(false)
  }

  // Send command to station
  const sendCommand = async (
    stationId: string,
    command: string,
    slotNumber?: number
  ): Promise<CommandResult> => {
    setCommandStatus({ type: 'pending', message: `Sending ${command} command...` })
    
    try {
      const response = await fetch(`/api/stations/${stationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, slotNumber }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setCommandStatus({ type: 'success', message: `${command} command completed successfully` })
        await mutate('/api/stations')
        return { success: true, data: result.data }
      } else {
        setCommandStatus({ type: 'error', message: result.error || 'Command failed' })
        return { success: false, error: result.error }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setCommandStatus({ type: 'error', message })
      return { success: false, error: message }
    }
  }

  // Auto-clear command status
  useEffect(() => {
    if (commandStatus && commandStatus.type !== 'pending') {
      const timer = setTimeout(() => setCommandStatus(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [commandStatus])

  // Command handlers
  const handleRefreshInventory = async (stationId: string) => {
    await sendCommand(stationId, 'query_inventory')
  }

  const handleForceEject = async (stationId: string, slotNumber: number) => {
    setConfirmDialog({
      open: true,
      title: 'Force Eject Power Bank',
      description: `Are you sure you want to force eject the power bank from slot ${slotNumber}? This will immediately release the power bank.`,
      variant: 'destructive',
      action: async () => {
        await sendCommand(stationId, 'force_eject', slotNumber)
        setConfirmDialog(null)
      },
    })
  }

  const handleFullEject = async (stationId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Eject All Power Banks',
      description: 'Are you sure you want to eject ALL power banks from this station? This action is typically used for maintenance.',
      variant: 'destructive',
      action: async () => {
        await sendCommand(stationId, 'full_eject')
        setConfirmDialog(null)
      },
    })
  }

  const handleReboot = async (stationId: string) => {
    setConfirmDialog({
      open: true,
      title: 'Reboot Station',
      description: 'Are you sure you want to reboot this station? The station will be offline for approximately 1-2 minutes.',
      variant: 'destructive',
      action: async () => {
        await sendCommand(stationId, 'reboot')
        setConfirmDialog(null)
      },
    })
  }

  const getBatteryIcon = (level: number) => {
    if (level >= 80) return <Battery className="h-4 w-4 text-green-500" />
    if (level >= 60) return <Battery className="h-4 w-4 text-green-400" />
    if (level >= 40) return <Battery className="h-4 w-4 text-yellow-500" />
    if (level >= 20) return <Battery className="h-4 w-4 text-orange-500" />
    return <Battery className="h-4 w-4 text-red-500" />
  }

  const getSignalStrength = (strength: number) => {
    if (strength >= 20) return { label: 'Excellent', color: 'text-green-500' }
    if (strength >= 15) return { label: 'Good', color: 'text-green-400' }
    if (strength >= 10) return { label: 'Fair', color: 'text-yellow-500' }
    if (strength >= 5) return { label: 'Weak', color: 'text-orange-500' }
    return { label: 'Poor', color: 'text-red-500' }
  }

  const formatTime = (isoString: string | null | undefined) => {
    if (!isoString) return '—'
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleTimeString()
  }

  const formatDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return '—'
    const date = new Date(isoString)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Hardware Management"
        description="Connected stations and real-time control"
        meta={
          stations.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {stats.online} online · {stats.offline} offline
            </p>
          ) : null
        }
        actions={
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {commandStatus && (
        <Alert variant={commandStatus.type === 'error' ? 'destructive' : 'default'}>
          {commandStatus.type === 'pending' && <Spinner className="h-4 w-4" />}
          {commandStatus.type === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
          {commandStatus.type === 'error' && <XCircle className="h-4 w-4" />}
          <AlertTitle>
            {commandStatus.type === 'pending' ? 'Processing' : 
             commandStatus.type === 'success' ? 'Success' : 'Error'}
          </AlertTitle>
          <AlertDescription>{commandStatus.message}</AlertDescription>
        </Alert>
      )}

      <AdminStatGrid columns={4}>
        <AdminStatCard label="Connected" value={stats.totalConnected} icon={Cpu} />
        <AdminStatCard label="Online" value={stats.online} icon={Wifi} trend="positive" />
        <AdminStatCard label="Offline" value={stats.offline} icon={WifiOff} />
        <AdminStatCard label="Power Banks" value={stats.totalPowerBanks} icon={BatteryCharging} />
      </AdminStatGrid>

      <AdminFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by station ID or serial number…"
        activeFilters={activeFilters}
        onClearFilters={searchQuery ? () => setSearchQuery('') : undefined}
      />

      {stationsError && (
        <AdminErrorBanner
          message="Failed to load stations. Check network connection and try again."
          onRetry={handleRefresh}
        />
      )}

      {isLoading ? (
        <AdminCardGridSkeleton count={6} />
      ) : !stationsError && filteredStations.length === 0 ? (
        <Card>
          <CardContent>
            <AdminEmptyState
              title={searchQuery ? 'No stations match your search' : 'No stations connected'}
              description={
                searchQuery
                  ? 'Try a different station ID or serial number.'
                  : 'Stations will appear here when they connect to the network.'
              }
            />
          </CardContent>
        </Card>
      ) : !stationsError ? (
        <>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {paginatedStations.map((station) => (
              <Card
                key={station.stationId}
                className={`transition-all ${station.isOnline ? 'hover:shadow-md hover:border-primary/20' : 'opacity-75'}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`size-2.5 shrink-0 rounded-full ${station.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                      <CardTitle className="text-base">{station.stationId}</CardTitle>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleRefreshInventory(station.stationId)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh Inventory
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setSelectedStation(station)}>
                          <Terminal className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleFullEject(station.stationId)}
                          className="text-orange-600"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Eject All
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleReboot(station.stationId)}
                          className="text-red-600"
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Reboot Station
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardDescription className="text-xs font-mono">
                    SN: {station.productSn}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status badges */}
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={station.isOnline ? 'online' : 'offline'} size="sm" />
                    {station.signalStrength > 0 && (
                      <Badge variant="outline" className={getSignalStrength(station.signalStrength).color}>
                        <Signal className="mr-1 h-3 w-3" />
                        {station.signalStrength}
                      </Badge>
                    )}
                    <Badge variant="outline">
                      <Battery className="mr-1 h-3 w-3" />
                      {station.availableSlots} slots
                    </Badge>
                  </div>

                  {/* Inventory slots */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {Array.from({ length: 8 }).map((_, i) => {
                      const slot = station.inventory.find(s => s.slotNumber === i + 1)
                      return (
                        <button
                          key={i}
                          onClick={() => slot && handleForceEject(station.stationId, i + 1)}
                          disabled={!slot || !station.isOnline}
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] transition-colors ${
                            slot
                              ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 cursor-pointer"
                              : "bg-muted text-muted-foreground"
                          }`}
                          title={slot ? `Slot ${i + 1}: ${slot.batteryLevel}% - Click to eject` : `Slot ${i + 1}: Empty`}
                        >
                          {slot ? getBatteryIcon(slot.batteryLevel) : <span className="text-lg">-</span>}
                          <span className="mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Last heartbeat */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last ping: {formatTime(station.lastHeartbeat)}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs"
                      onClick={() => setSelectedStation(station)}
                    >
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
          ))}
        </div>
        <AdminPaginationBar
          page={page}
          pageSize={pageSize}
          total={filteredStations.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
        </>
      ) : null}

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
                    className={`size-2.5 shrink-0 rounded-full ${selectedStation.isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`}
                    aria-hidden
                  />
                  {selectedStation.stationId}
                </span>
              }
              description={
                <span className="font-mono text-xs sm:text-sm">
                  Serial: {selectedStation.productSn}
                </span>
              }
            />

            <AdminDrawerBody>
              <AdminDrawerSection title="Connection Info" icon={Wifi}>
                <AdminDrawerFieldList>
                  <AdminDrawerField
                    label="Status"
                    value={
                      <StatusBadge
                        status={selectedStation.isOnline ? 'connected' : 'disconnected'}
                        size="sm"
                      />
                    }
                  />
                  <AdminDrawerField
                    label="Connected At"
                    value={formatDateTime(selectedStation.connectedAt)}
                  />
                  <AdminDrawerField
                    label="Last Heartbeat"
                    value={formatDateTime(selectedStation.lastHeartbeat)}
                  />
                  {selectedStation.signalStrength > 0 && (
                    <AdminDrawerField
                      label="Signal Strength"
                      value={
                        <span className={getSignalStrength(selectedStation.signalStrength).color}>
                          {selectedStation.signalStrength}/31 (
                          {getSignalStrength(selectedStation.signalStrength).label})
                        </span>
                      }
                    />
                  )}
                  {selectedStation.iccid && (
                    <AdminDrawerField label="ICCID" value={selectedStation.iccid} mono />
                  )}
                  {selectedStation.firmwareVersion && (
                    <AdminDrawerField label="Firmware" value={selectedStation.firmwareVersion} />
                  )}
                </AdminDrawerFieldList>
              </AdminDrawerSection>

              <AdminDrawerSection
                title="Recent protocol events"
                description="Last 30 inbound/outbound hardware events"
                icon={Terminal}
              >
                {hardwareEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events recorded yet</p>
                ) : (
                  <div className="max-h-48 space-y-2 overflow-y-auto overscroll-contain">
                    {hardwareEvents.map((ev) => (
                      <AdminDrawerPanel
                        key={ev.id}
                        className="flex items-center justify-between gap-2 text-xs"
                        padding="default"
                      >
                        <span className="font-mono">{ev.event_type}</span>
                        <span className="text-muted-foreground">{ev.direction}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {formatTime(ev.created_at)}
                        </span>
                      </AdminDrawerPanel>
                    ))}
                  </div>
                )}
              </AdminDrawerSection>

              <AdminDrawerSection
                title={`Inventory (${selectedStation.availableSlots} power banks)`}
                icon={Battery}
              >
                <div className="mb-3 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRefreshInventory(selectedStation.stationId)}
                  >
                    <RefreshCw className="mr-2 size-4" aria-hidden />
                    Refresh inventory
                  </Button>
                </div>
                {selectedStation.inventory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No power banks in station</p>
                ) : (
                  <div className="space-y-2">
                    {selectedStation.inventory.map((slot) => (
                      <AdminDrawerPanel
                        key={slot.slotNumber}
                        className="flex items-center justify-between gap-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {getBatteryIcon(slot.batteryLevel)}
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              Slot {String(slot.slotNumber).padStart(2, '0')}
                            </p>
                            <p className="truncate font-mono text-xs text-muted-foreground">
                              {slot.terminalId}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline">{slot.batteryLevel}%</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={`Force eject slot ${slot.slotNumber}`}
                            onClick={() =>
                              handleForceEject(selectedStation.stationId, slot.slotNumber)
                            }
                          >
                            <LogOut className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </AdminDrawerPanel>
                    ))}
                  </div>
                )}
              </AdminDrawerSection>
            </AdminDrawerBody>

            <AdminDrawerFooter align="stretch">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleRefreshInventory(selectedStation.stationId)}
                disabled={!selectedStation.isOnline}
              >
                <RefreshCw className="mr-2 size-4" aria-hidden />
                Sync
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => sendCommand(selectedStation.stationId, 'query_info')}
                disabled={!selectedStation.isOnline}
              >
                <Signal className="mr-2 size-4" aria-hidden />
                Status
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-orange-600 hover:text-orange-600"
                onClick={() => handleFullEject(selectedStation.stationId)}
                disabled={!selectedStation.isOnline}
              >
                <LogOut className="mr-2 size-4" aria-hidden />
                Eject All
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-red-600 hover:text-red-600"
                onClick={() => handleReboot(selectedStation.stationId)}
                disabled={!selectedStation.isOnline}
              >
                <Power className="mr-2 size-4" aria-hidden />
                Reboot
              </Button>
            </AdminDrawerFooter>
          </>
        )}
      </AdminDrawer>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog?.open} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog?.title}</DialogTitle>
            <DialogDescription>{confirmDialog?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmDialog?.variant === 'destructive' ? 'destructive' : 'default'}
              onClick={confirmDialog?.action}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
