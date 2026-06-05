"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Search, Users, Mail, Download, UserCheck, UserX, Clock, Zap, MapPin, Calendar } from "lucide-react"
import { useUsers, useSessions } from "@/hooks/use-services"
import { downloadCsv } from "@/lib/admin/export-csv"
import { AdminErrorBanner } from "@/components/admin/admin-states"
import { formatDateTime } from "@/lib/utils"
import type { User, RentalSession } from "@/lib/types"

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [consentFilter, setConsentFilter] = useState<string>("all")
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [selectedLead, setSelectedLead] = useState<User | null>(null)

  const { data: users, loading: usersLoading, error: usersError, fetchUsers, refetch } = useUsers()
  const { data: allSessions, fetchSessions } = useSessions()

  // Fetch users on mount with filters
  useEffect(() => {
    const filters: Parameters<typeof fetchUsers>[0] = {}
    if (searchQuery) filters.search = searchQuery
    if (consentFilter === "marketing") filters.marketingConsent = true
    if (consentFilter === "no-marketing") filters.marketingConsent = false
    fetchUsers(filters)
  }, [searchQuery, consentFilter, fetchUsers])

  // Fetch sessions for selected lead
  useEffect(() => {
    if (selectedLead) {
      fetchSessions({ search: selectedLead.email })
    }
  }, [selectedLead?.id, fetchSessions])

  const filteredLeads = users || []
  const leadSessions = selectedLead 
    ? (allSessions?.filter(s => s.userEmail === selectedLead.email) || [])
    : []

  const stats = {
    total: filteredLeads.length,
    withMarketing: filteredLeads.filter(l => l.marketingConsent).length,
    thisWeek: filteredLeads.filter(l => {
      const date = new Date(l.createdAt)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      return date > weekAgo
    }).length,
    activeRenters: filteredLeads.filter(l => l.totalRentals > 1).length,
  }

  const toggleSelectLead = (id: string) => {
    setSelectedLeads(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id))
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Leads & CRM</h1>
          <p className="text-sm text-muted-foreground">Manage captured user data and consent</p>
        </div>
        <Button
          variant="outline"
          disabled={!filteredLeads.length}
          onClick={() =>
            downloadCsv(
              'powerdon-leads.csv',
              ['email', 'name', 'marketingConsent', 'totalRentals', 'createdAt'],
              filteredLeads.map((l) => [
                l.email,
                l.name ?? '',
                l.marketingConsent,
                l.totalRentals,
                new Date(l.createdAt).toISOString(),
              ]),
            )
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {usersError && <AdminErrorBanner message={usersError} onRetry={() => refetch()} />}

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.withMarketing}</p>
                <p className="text-xs text-muted-foreground">Marketing Consent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.thisWeek}</p>
                <p className="text-xs text-muted-foreground">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Zap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">{stats.activeRenters}</p>
                <p className="text-xs text-muted-foreground">Repeat Renters</p>
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
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={consentFilter} onValueChange={setConsentFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Consent Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Leads</SelectItem>
            <SelectItem value="marketing">Marketing Consent</SelectItem>
            <SelectItem value="no-marketing">No Marketing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {usersLoading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rentals</TableHead>
                  <TableHead>Total Spent</TableHead>
                  <TableHead>Marketing</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => (
                  <TableRow 
                    key={lead.id} 
                    className="cursor-pointer"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={selectedLeads.includes(lead.id)}
                        onCheckedChange={() => toggleSelectLead(lead.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{lead.email}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{lead.totalRentals}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">€{lead.totalSpent.toFixed(2)}</TableCell>
                    <TableCell>
                      {lead.marketingConsent ? (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      ) : (
                        <UserX className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(new Date(lead.createdAt))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="space-y-3 lg:hidden">
            {filteredLeads.map((lead, index) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className="cursor-pointer"
                  onClick={() => setSelectedLead(lead)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={selectedLeads.includes(lead.id)}
                          onCheckedChange={() => toggleSelectLead(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div>
                          <p className="font-medium text-foreground">{lead.email}</p>
                          {lead.name && (
                            <p className="text-sm text-muted-foreground">{lead.name}</p>
                          )}
                        </div>
                      </div>
                      {lead.marketingConsent ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">Opted In</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">No Marketing</Badge>
                      )}
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
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Lead Detail Sheet */}
      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedLead && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle>{selectedLead.email}</SheetTitle>
              </SheetHeader>

              <div className="space-y-6">
                {/* Profile Info */}
                <Card>
                  <CardContent className="p-4 space-y-3">
                    {selectedLead.name && (
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedLead.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Joined: {formatDateTime(new Date(selectedLead.createdAt))}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xl font-semibold text-foreground">{selectedLead.totalRentals}</p>
                      <p className="text-xs text-muted-foreground">Total Rentals</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-xl font-semibold text-foreground">€{selectedLead.totalSpent.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Total Spent</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Consent Details */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Consent & Preferences</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground">Account created</span>
                      <span className="text-sm">{formatDateTime(new Date(selectedLead.createdAt))}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground">Marketing Emails</span>
                      {selectedLead.marketingConsent ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700">Opted In</Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600">Opted Out</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Rental History */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Rental History</h4>
                  {leadSessions.length > 0 ? (
                    <div className="space-y-2">
                      {leadSessions.map((session) => (
                        <Card key={session.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{session.stationName}</span>
                              <Badge variant="secondary" className="text-xs">
                                {session.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{session.durationMinutes ? `${session.durationMinutes}m` : 'Active'}</span>
                              <span>€{session.amountCharged.toFixed(2)}</span>
                              <span>{formatDateTime(new Date(session.startTime))}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No rental history</p>
                  )}
                </div>

                {/* Actions */}
                {selectedLead.email && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={`mailto:${selectedLead.email}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Contact via email
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {filteredLeads.length === 0 && !usersLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No leads found</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
