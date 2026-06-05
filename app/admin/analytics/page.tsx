"use client"

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Download, Clock, Zap, Euro, Gift, RefreshCw } from "lucide-react"
import { formatNumber } from '@/lib/utils';
import { daysFromRange } from '@/lib/admin/date-range';
import { downloadCsv } from '@/lib/admin/export-csv';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminStatCard, AdminStatGrid } from '@/components/admin/admin-stat-card';
import { AdminErrorBanner, AdminEmptyState } from '@/components/admin/admin-states';
import { AdminChartSkeleton, AdminStatGridSkeleton } from '@/components/admin/admin-skeletons';
import { analyticsService } from '@/lib/services';
import { isSuccessResponse } from '@/lib/api/client';
import type { 
  RevenueAnalytics, 
  SessionAnalytics, 
  RewardAnalytics, 
  FunnelAnalytics 
} from '@/lib/api/types';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [revenueData, setRevenueData] = useState<RevenueAnalytics | null>(null);
  const [sessionData, setSessionData] = useState<SessionAnalytics | null>(null);
  const [rewardData, setRewardData] = useState<RewardAnalytics | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelAnalytics | null>(null);
  const [hourlyData, setHourlyData] = useState<{ hour: string; count: number }[]>([]);
  const [durationDistribution, setDurationDistribution] = useState<
    { name: string; value: number; count: number; color: string }[]
  >([]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    const days = daysFromRange(timeRange);
    
    try {
      const range = { days };
      const [revenueRes, sessionRes, rewardRes, funnelRes, hourlyRes, durationRes] = await Promise.all([
        analyticsService.getRevenueAnalytics(range),
        analyticsService.getSessionAnalytics(range),
        analyticsService.getRewardAnalytics(range),
        analyticsService.getFunnelAnalytics(),
        analyticsService.getHourlyDistribution(range),
        analyticsService.getDurationDistribution(range),
      ]);
      
      if (isSuccessResponse(revenueRes)) setRevenueData(revenueRes.data);
      if (isSuccessResponse(sessionRes)) setSessionData(sessionRes.data);
      if (isSuccessResponse(rewardRes)) setRewardData(rewardRes.data);
      if (isSuccessResponse(funnelRes)) setFunnelData(funnelRes.data);
      if (isSuccessResponse(hourlyRes)) setHourlyData(hourlyRes.data);
      if (isSuccessResponse(durationRes)) setDurationDistribution(durationRes.data);
    } catch (err) {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, timeRange]);

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const hasRevenueChartData = (revenueData?.revenueByPeriod?.length ?? 0) > 0;
  const hasHourlyData = hourlyData.some((d) => d.count > 0);
  const hasDurationData = durationDistribution.some((d) => d.count > 0);
  const hasStationData = (sessionData?.sessionsByStation?.length ?? 0) > 0;

  if (loading && !revenueData) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Analytics"
          description="Revenue, rentals, and reward performance"
        />
        <AdminStatGridSkeleton />
        <div className="grid gap-6 lg:grid-cols-2">
          <AdminChartSkeleton />
          <AdminChartSkeleton />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <AdminChartSkeleton />
          <AdminChartSkeleton className="lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Analytics"
        description="Revenue, rentals, and reward performance"
        actions={
          <>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!revenueData}
              onClick={() => {
                if (!revenueData) return;
                downloadCsv(
                  `powerdon-analytics-${timeRange}.csv`,
                  ['period', 'revenue', 'sessions'],
                  revenueData.revenueByPeriod.map((r) => [r.period, r.revenue, r.sessions]),
                );
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      {error && !revenueData && (
        <AdminErrorBanner message={error} onRetry={fetchAnalytics} />
      )}

      {loading && revenueData ? (
        <div className="flex items-center justify-center py-4">
          <Spinner className="h-5 w-5" />
        </div>
      ) : null}

      <AdminStatGrid columns={4}>
        <AdminStatCard
          label="Total Revenue"
          value={revenueData ? `€${formatNumber(revenueData.totalRevenue)}` : '—'}
          icon={Euro}
        />
        <AdminStatCard
          label="Total Rentals"
          value={sessionData ? formatNumber(sessionData.totalSessions) : '—'}
          icon={Zap}
        />
        <AdminStatCard
          label="Avg Duration"
          value={sessionData ? formatDuration(sessionData.averageDuration) : '—'}
          icon={Clock}
        />
        <AdminStatCard
          label="Reward Rate"
          value={rewardData ? `${rewardData.redemptionRate.toFixed(0)}%` : '—'}
          icon={Gift}
        />
      </AdminStatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Revenue & Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {!hasRevenueChartData ? (
                <AdminEmptyState title="No revenue data in this period" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData?.revenueByPeriod || []}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`€${value}`, 'Revenue']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Hourly Usage Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {!hasHourlyData ? (
                <AdminEmptyState title="No rental activity in this period" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="hour" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Rentals" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Duration Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              {!hasDurationData ? (
                <AdminEmptyState title="No completed rentals in range" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={durationDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {durationDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            {hasDurationData && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {durationDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium ml-auto">{item.value}% ({item.count})</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">Station Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {!hasStationData ? (
                <AdminEmptyState title="No station activity in this period" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sessionData?.sessionsByStation || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis type="category" dataKey="stationName" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} width={100} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Rentals" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {funnelData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Conversion Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnelData.stages.map((stage, index) => {
                const widthPercent = (stage.count / funnelData.stages[0].count) * 100;
                
                return (
                  <div key={stage.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{stage.stage}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{formatNumber(stage.count)}</span>
                        {index > 0 && (
                          <span className="text-xs text-muted-foreground">({stage.conversionRate.toFixed(1)}%)</span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">
                  {funnelData.stages[1] ? ((funnelData.stages[1].count / funnelData.stages[0].count) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Scan to info</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">
                  {funnelData.stages[2] && funnelData.stages[1] ? ((funnelData.stages[2].count / funnelData.stages[1].count) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Info to payment</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">
                  {funnelData.stages[3] && funnelData.stages[2] ? ((funnelData.stages[3].count / funnelData.stages[2].count) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Payment to rental</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">{funnelData.overallConversion.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Overall conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
