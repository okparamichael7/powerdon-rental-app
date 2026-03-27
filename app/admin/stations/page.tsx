"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Plus, MapPin, Battery, Wifi, WifiOff, Zap, Clock, AlertTriangle } from "lucide-react"
import { useStations, useSessions } from "@/hooks/use-services"
import type { Station, RentalSession } from "@/lib/types"
import { formatDateTime } from "@/lib/utils"

export default function StationsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  
  const { data: stations, loading, fetchStations } = useStations()
  const { data: allSessions, fetchSessions } = useSessions()

  // Fetch stations on mount with filters
  useEffect(() => {
    const filters: Parameters<typeof fetchStations>[0] = {}
    if (searchQuery) filters.search = searchQuery
    if (statusFilter !== "all") filters.status = [statusFilter as Station["status"]]
    fetchStations(filters)
  }, [searchQuery, statusFilter, fetchStations])

  // Fetch sessions for selected station
  useEffect(() => {
    if (selectedStation) {
      fetchSessions({ stationId: selectedStation.id, limit: 5 })
    }
  }, [selectedStation?.id, fetchSessions])

  const filteredStations = stations || []
  const stationSessions = selectedStation 
    ? (allSessions?.filter(s => s.stationId === selectedStation.id).slice(0, 5) || [])
    : []

  const getStatusColor = (status: Station["status"]) => {
    switch (status) {
      case "online": return "bg-green-500"
      case "offline": return "bg-gray-400"
      case "maintenance": return "bg-amber-500"
      case "low-battery": return "bg-red-500"
      default: return "bg-gray-400"
    }
  }

  const getStatusBadge = (status: Station["status"]) => {
    switch (status) {
      case "online": return <Badge variant="secondary" className="bg-green-100 text-green-700">Online</Badge>
      case "offline": return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Offline</Badge>
      case "maintenance": return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Maintenance</Badge>
      case "low-battery": return <Badge variant="secondary" className="bg-red-100 text-red-700">Low Battery</Badge>
      default: return null
    }
  }

  const stats = {
    online: filteredStations.filter(s => s.status === "online").length,
    offline: filteredStations.filter(s => s.status === "offline").length,
    maintenance: filteredStations.filter(s => s.status === "maintenance").length,
    totalSlots: filteredStations.reduce((sum, s) => sum + s.totalSlots, 0),
    availableSlots: filteredStations.reduce((sum, s) => sum + s.availableSlots, 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Stations</h1>
          <p className="text-sm text-muted-foreground">Monitor and manage power bank stations</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Station
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Wifi className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats.online}</p>
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
                <p className="text-2xl font-semibold text-foreground">{stats.offline}</p>
                <p className="text-xs text-muted-foreground">Offline</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats.maintenance}</p>
                <p className="text-xs text-muted-foreground">Maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Battery className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">{stats.availableSlots}/{stats.totalSlots}</p>
                <p className="text-xs text-muted-foreground">Available Slots</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search stations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
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
      </div>

      {/* Stations Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStations.map((station, index) => (
            <motion.div
              key={station.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card 
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
                onClick={() => setSelectedStation(station)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${getStatusColor(station.status)}`} />
                      <span className="font-medium text-foreground">{station.name}</span>
                    </div>
                    {getStatusBadge(station.status)}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate">{station.location}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Battery className="h-3.5 w-3.5" />
                        <span>{station.availableSlots}/{station.totalSlots} available</span>
                      </div>
                    </div>
                    
                    {/* Slot visualization */}
                    <div className="flex gap-1 mt-2">
                      {Array.from({ length: station.totalSlots }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${
                            i < station.availableSlots ? "bg-primary" : "bg-gray-200"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>ID: {station.id}</span>
                    <span>Battery: {station.batteryLevel}%</span>
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
                  <div className={`h-3 w-3 rounded-full ${getStatusColor(selectedStation.status)}`} />
                  <SheetTitle>{selectedStation.name}</SheetTitle>
                </div>
              </SheetHeader>

              <div className="space-y-6">
                {/* Status & Info */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      {getStatusBadge(selectedStation.status)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground mb-1">Availability</p>
                      <p className="text-lg font-semibold">{selectedStation.availableSlots}/{selectedStation.totalSlots}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Location */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-foreground">{selectedStation.location}</p>
                        <p className="text-sm text-muted-foreground">Station ID: {selectedStation.id}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Slots */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Slot Status</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: selectedStation.totalSlots }).map((_, i) => {
                      const isAvailable = i < selectedStation.availableSlots
                      return (
                        <div
                          key={i}
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs ${
                            isAvailable 
                              ? "bg-primary/10 text-primary border border-primary/20" 
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Battery className="h-4 w-4 mb-1" />
                          <span>Slot {String(i + 1).padStart(2, "0")}</span>
                          <span className="text-[10px]">{isAvailable ? "Ready" : "In Use"}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Recent Activity</h4>
                  {stationSessions.length > 0 ? (
                    <div className="space-y-2">
                      {stationSessions.map((session) => (
                        <Card key={session.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">{session.userEmail}</span>
                              </div>
                              <Badge variant="secondary" className="text-xs">
                                {session.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {session.durationMinutes ? `${session.durationMinutes}m` : 'Active'}
                              </span>
                              <span>{formatDateTime(new Date(session.startTime))}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent activity</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1">Edit Station</Button>
                  <Button variant="outline" className="flex-1">View Logs</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
