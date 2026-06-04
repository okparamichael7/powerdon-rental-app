"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
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
  Search,
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
  AlertTriangle,
  Zap,
} from "lucide-react"
import useSWR, { mutate } from "swr"

// Types for hardware API responses
interface HardwareStation {
  stationId: string
  productSn: string
  isOnline: boolean
  connectedAt: string
  lastHeartbeat: string
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

interface StationInventory {
  stationId: string
  isOnline: boolean
  totalSlots: number
  availableSlots: number
  lastUpdate: string | null
  slots: {
    slotNumber: number
    terminalId: string
    formattedTerminalId: string
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

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString()
  }

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Hardware Management</h1>
          <p className="text-sm text-muted-foreground">WsCharge protocol - Connected stations and real-time control</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Command Status Alert */}
      <AnimatePresence>
        {commandStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Cpu className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.totalConnected}</p>
                <p className="text-xs text-muted-foreground">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Wifi className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.online}</p>
                <p className="text-xs text-muted-foreground">Online</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <WifiOff className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.offline}</p>
                <p className="text-xs text-muted-foreground">Offline</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <BatteryCharging className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.totalPowerBanks}</p>
                <p className="text-xs text-muted-foreground">Power Banks</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by station ID or serial number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Station List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner className="h-8 w-8" />
        </div>
      ) : stationsError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">Failed to load stations</p>
            <p className="text-sm text-muted-foreground mt-1">Check network connection and try again</p>
            <Button onClick={handleRefresh} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : filteredStations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Cpu className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">No stations connected</p>
            <p className="text-sm text-muted-foreground mt-1">
              Stations will appear here when they connect via TCP
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredStations.map((station, index) => (
            <motion.div
              key={station.stationId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`transition-all ${station.isOnline ? 'hover:shadow-md hover:border-primary/20' : 'opacity-75'}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${station.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
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
                    <Badge variant={station.isOnline ? "secondary" : "outline"} className={station.isOnline ? "bg-green-100 text-green-700" : ""}>
                      {station.isOnline ? 'Online' : 'Offline'}
                    </Badge>
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
            </motion.div>
          ))}
        </div>
      )}

      {/* Station Detail Sheet */}
      <Sheet open={!!selectedStation} onOpenChange={() => setSelectedStation(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedStation && (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${selectedStation.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <SheetTitle>{selectedStation.stationId}</SheetTitle>
                </div>
                <SheetDescription className="font-mono">
                  Serial: {selectedStation.productSn}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                {/* Connection Info */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Connection Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={selectedStation.isOnline ? "secondary" : "outline"}>
                        {selectedStation.isOnline ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Connected At</span>
                      <span>{formatDateTime(selectedStation.connectedAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Heartbeat</span>
                      <span>{formatDateTime(selectedStation.lastHeartbeat)}</span>
                    </div>
                    {selectedStation.signalStrength > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Signal Strength</span>
                        <span className={getSignalStrength(selectedStation.signalStrength).color}>
                          {selectedStation.signalStrength}/31 ({getSignalStrength(selectedStation.signalStrength).label})
                        </span>
                      </div>
                    )}
                    {selectedStation.iccid && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ICCID</span>
                        <span className="font-mono text-xs">{selectedStation.iccid}</span>
                      </div>
                    )}
                    {selectedStation.firmwareVersion && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Firmware</span>
                        <span>{selectedStation.firmwareVersion}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent protocol events */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Recent protocol events</CardTitle>
                    <CardDescription>Last 30 inbound/outbound hardware events</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {hardwareEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No events recorded yet</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {hardwareEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-center justify-between text-xs p-2 rounded bg-muted/50"
                          >
                            <span className="font-mono">{ev.event_type}</span>
                            <span className="text-muted-foreground">{ev.direction}</span>
                            <span className="text-muted-foreground">{formatTime(ev.created_at)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Inventory */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Inventory ({selectedStation.availableSlots} power banks)</CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleRefreshInventory(selectedStation.stationId)}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedStation.inventory.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No power banks in station</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedStation.inventory.map((slot) => (
                          <div
                            key={slot.slotNumber}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              {getBatteryIcon(slot.batteryLevel)}
                              <div>
                                <p className="font-medium text-sm">Slot {String(slot.slotNumber).padStart(2, '0')}</p>
                                <p className="text-xs text-muted-foreground font-mono">{slot.terminalId}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{slot.batteryLevel}%</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleForceEject(selectedStation.stationId, slot.slotNumber)}
                              >
                                <LogOut className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleRefreshInventory(selectedStation.stationId)}
                      disabled={!selectedStation.isOnline}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => sendCommand(selectedStation.stationId, 'query_info')}
                      disabled={!selectedStation.isOnline}
                    >
                      <Signal className="mr-2 h-4 w-4" />
                      Status
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleFullEject(selectedStation.stationId)}
                      disabled={!selectedStation.isOnline}
                      className="text-orange-600 hover:text-orange-600"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Eject All
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleReboot(selectedStation.stationId)}
                      disabled={!selectedStation.isOnline}
                      className="text-red-600 hover:text-red-600"
                    >
                      <Power className="mr-2 h-4 w-4" />
                      Reboot
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

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
