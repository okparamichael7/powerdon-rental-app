"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { Search, Gift, Ticket, CheckCircle, Clock, XCircle, Download, Copy, Check } from "lucide-react"
import { useRewards, useCampaigns } from "@/hooks/use-services"
import { formatDateTime } from "@/lib/utils"
import type { Reward } from "@/lib/types"

export default function RewardsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [campaignFilter, setCampaignFilter] = useState<string>("all")
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const { data: rewards, loading: rewardsLoading, fetchRewards } = useRewards()
  const { data: campaigns, loading: campaignsLoading, fetchCampaigns } = useCampaigns()

  // Fetch data on mount and when filters change
  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  useEffect(() => {
    const filters: Parameters<typeof fetchRewards>[0] = {}
    if (searchQuery) filters.search = searchQuery
    if (statusFilter !== "all") filters.status = [statusFilter as Reward["status"]]
    if (campaignFilter !== "all") filters.campaignId = campaignFilter
    fetchRewards(filters)
  }, [searchQuery, statusFilter, campaignFilter, fetchRewards])

  const filteredRewards = rewards || []
  const loading = rewardsLoading || campaignsLoading

  const getStatusBadge = (status: Reward["status"]) => {
    switch (status) {
      case "issued": return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Issued</Badge>
      case "redeemed": return <Badge variant="secondary" className="bg-green-100 text-green-700">Redeemed</Badge>
      case "expired": return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Expired</Badge>
      case "pending": return <Badge variant="secondary" className="bg-amber-100 text-amber-700">Pending</Badge>
      case "qualified": return <Badge variant="secondary" className="bg-primary/10 text-primary">Qualified</Badge>
      default: return null
    }
  }

  const stats = {
    total: filteredRewards.length,
    issued: filteredRewards.filter(r => r.status === "issued").length,
    redeemed: filteredRewards.filter(r => r.status === "redeemed").length,
    expired: filteredRewards.filter(r => r.status === "expired").length,
    totalValue: filteredRewards.reduce((sum, r) => sum + r.value, 0),
    redeemedValue: filteredRewards.filter(r => r.status === "redeemed").reduce((sum, r) => sum + r.value, 0),
  }

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Rewards & Vouchers</h1>
          <p className="text-sm text-muted-foreground">Track issued vouchers and redemptions</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground tabular-nums">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Issued</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground tabular-nums">{stats.redeemed}</p>
                <p className="text-xs text-muted-foreground">Redeemed</p>
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
                <p className="text-lg font-semibold text-foreground tabular-nums">{stats.issued}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Ticket className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground tabular-nums">€{stats.redeemedValue}</p>
                <p className="text-xs text-muted-foreground">Value Redeemed</p>
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
            placeholder="Search by code or email..."
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
            {(campaigns || []).map(campaign => (
              <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRewards.map((reward) => {
                  const campaign = campaigns?.find(c => c.id === reward.campaignId)
                  return (
                    <TableRow key={reward.id}>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm font-mono">{reward.code}</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{reward.userEmail}</TableCell>
                      <TableCell>{campaign?.name || reward.campaignName}</TableCell>
                      <TableCell className="font-medium">€{reward.value}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(new Date(reward.issuedAt))}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDateTime(new Date(reward.expiresAt))}</TableCell>
                      <TableCell>{getStatusBadge(reward.status)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopyCode(reward.code)}
                        >
                          {copiedCode === reward.code ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Mobile Cards */}
          <div className="space-y-3 lg:hidden">
            {filteredRewards.map((reward, index) => {
              const campaign = campaigns?.find(c => c.id === reward.campaignId)
              return (
                <motion.div
                  key={reward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <code className="rounded bg-muted px-2 py-1 text-sm font-mono">{reward.code}</code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => handleCopyCode(reward.code)}
                            >
                              {copiedCode === reward.code ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground">{reward.userEmail}</p>
                        </div>
                        {getStatusBadge(reward.status)}
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
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </>
      )}

      {filteredRewards.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gift className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No rewards found</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
