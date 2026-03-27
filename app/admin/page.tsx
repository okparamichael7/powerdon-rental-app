'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/volt/status-badge';
import { Spinner } from '@/components/ui/spinner';
import { useDashboardStats, useSessions, useStations } from '@/hooks/use-services';
import { analyticsService } from '@/lib/services';
import { isSuccessResponse } from '@/lib/api/client';
import { 
  Zap, 
  Euro, 
  Gift, 
  Radio, 
  TrendingUp, 
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import type { FunnelAnalytics } from '@/lib/api/types';

export default function AdminOverviewPage() {
  // Fetch data via service hooks
  const { data: dashboardStats, loading: statsLoading } = useDashboardStats();
  const { data: sessions, loading: sessionsLoading, fetchSessions } = useSessions();
  const { data: stations, loading: stationsLoading, fetchStations } = useStations();
  
  // Local state for analytics data
  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number; sessions: number }[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelAnalytics['stages']>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Fetch sessions and stations on mount
  useEffect(() => {
    fetchSessions({ limit: 5 });
    fetchStations({ limit: 4 });
  }, [fetchSessions, fetchStations]);

  // Fetch analytics data
  useEffect(() => {
    async function loadAnalytics() {
      setAnalyticsLoading(true);
      try {
        const [revenueRes, funnelRes] = await Promise.all([
          analyticsService.getDailyRevenue(),
          analyticsService.getFunnelAnalytics(),
        ]);
        
        if (isSuccessResponse(revenueRes)) {
          setRevenueData(revenueRes.data);
        }
        if (isSuccessResponse(funnelRes)) {
          setFunnelData(funnelRes.data.stages);
        }
      } finally {
        setAnalyticsLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  const isLoading = statsLoading || sessionsLoading || stationsLoading || analyticsLoading;

  // Build stats cards from dashboard data
  const stats = dashboardStats ? [
    {
      name: 'Active Sessions',
      value: dashboardStats.activeSessions,
      change: '+12%',
      changeType: 'positive' as const,
      icon: Zap,
    },
    {
      name: 'Total Revenue',
      value: `€${dashboardStats.totalRevenue.toLocaleString()}`,
      change: '+8.2%',
      changeType: 'positive' as const,
      icon: Euro,
    },
    {
      name: 'Rewards Issued',
      value: dashboardStats.totalRewardsIssued,
      change: '+23%',
      changeType: 'positive' as const,
      icon: Gift,
    },
    {
      name: 'Stations Online',
      value: `${dashboardStats.stationsOnline}/${dashboardStats.stationsTotal}`,
      change: '-1',
      changeType: 'negative' as const,
      icon: Radio,
    },
  ] : [];

  const recentSessions = sessions?.slice(0, 5) || [];
  const stationHealth = stations?.slice(0, 4) || [];

  // Transform funnel data for chart
  const chartFunnelData = funnelData.map(s => ({
    stage: s.stage,
    count: s.count,
    percentage: Math.round(s.conversionRate),
  }));

  if (isLoading && !dashboardStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your rental operations in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </Badge>
          <span className="text-sm text-muted-foreground">
            Last updated: Just now
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="relative overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{stat.name}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <div className={`flex items-center gap-1 text-xs font-medium ${
                    stat.changeType === 'positive' ? 'text-emerald-600' : 'text-red-600'
                  }`}>
                    {stat.changeType === 'positive' ? (
                      <ArrowUpRight size={14} />
                    ) : (
                      <ArrowDownRight size={14} />
                    )}
                    {stat.change} vs last week
                  </div>
                </div>
                <div className="p-2.5 bg-primary/10 rounded-lg">
                  <stat.icon size={20} className="text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Revenue Overview</CardTitle>
              <Badge variant="secondary" className="text-xs">This Week</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                    tickFormatter={(value) => `€${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Funnel Chart */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Conversion Funnel</CardTitle>
              <Badge variant="secondary" className="text-xs">All Time</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartFunnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                  <XAxis 
                    type="number" 
                    axisLine={false}
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                  />
                  <YAxis 
                    type="category" 
                    dataKey="stage" 
                    axisLine={false}
                    tickLine={false}
                    className="text-xs fill-muted-foreground"
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string, props: { payload: { percentage: number } }) => [
                      `${value.toLocaleString()} (${props.payload.percentage}%)`,
                      'Count'
                    ]}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sessions */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Sessions</CardTitle>
              <a href="/admin/sessions" className="text-sm text-primary hover:underline">
                View all
              </a>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sessionsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Spinner />
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Session
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Station
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {recentSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <p className="font-medium text-foreground font-mono text-sm">
                                {session.sessionCode}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatTime(new Date(session.startTime))}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-foreground">{session.userName || 'Anonymous'}</p>
                            <p className="text-xs text-muted-foreground">{session.userEmail}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-foreground">
                            {session.stationName}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={session.status} size="sm" />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="font-medium text-foreground">
                              €{session.amountCharged.toFixed(2)}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-border">
                  {recentSessions.map((session) => (
                    <div key={session.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-medium text-foreground">
                          {session.sessionCode}
                        </span>
                        <StatusBadge status={session.status} size="sm" />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{session.userName || session.userEmail}</span>
                        <span className="font-medium text-foreground">€{session.amountCharged.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{session.stationName}</span>
                        <span>{formatTime(new Date(session.startTime))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Station Health */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Station Health</CardTitle>
              <a href="/admin/stations" className="text-sm text-primary hover:underline">
                View all
              </a>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {stationsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Spinner />
              </div>
            ) : (
              stationHealth.map((station) => (
                <div
                  key={station.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-sm text-foreground">{station.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{station.availableSlots}/{station.totalSlots} slots</span>
                      <span>•</span>
                      <span>{station.batteryLevel}% battery</span>
                    </div>
                  </div>
                  <StatusBadge status={station.status} size="sm" />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      {dashboardStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <TrendingUp size={18} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversion Rate</p>
                <p className="text-lg font-bold text-foreground">{dashboardStats.conversionRate}%</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Clock size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Duration</p>
                <p className="text-lg font-bold text-foreground">{dashboardStats.averageSessionDuration}m</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <Euro size={18} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deposits Held</p>
                <p className="text-lg font-bold text-foreground">€{dashboardStats.totalDepositsHeld}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Gift size={18} className="text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rewards Redeemed</p>
                <p className="text-lg font-bold text-foreground">{dashboardStats.totalRewardsRedeemed}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
