'use client';

import { useEffect, useState } from 'react';
import { formatTime, formatNumber } from '@/lib/utils';
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
      change: null,
      changeType: 'neutral' as const,
      icon: Zap,
    },
    {
      name: 'Total Revenue',
      value: `€${formatNumber(dashboardStats.totalRevenue)}`,
      change: null,
      changeType: 'neutral' as const,
      icon: Euro,
    },
    {
      name: 'Rewards Issued',
      value: dashboardStats.totalRewardsIssued,
      change: null,
      changeType: 'neutral' as const,
      icon: Gift,
    },
    {
      name: 'Stations Online',
      value: `${dashboardStats.stationsOnline}/${dashboardStats.stationsTotal}`,
      change: null,
      changeType: 'neutral' as const,
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
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-medium text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor rental operations
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-2 md:mt-0">
          Updated just now
        </p>
      </div>

      {/* Alerts Banner */}
      {dashboardStats && dashboardStats.stationsOnline < dashboardStats.stationsTotal && (
        <div className="flex items-center justify-between py-3 px-4 bg-muted rounded-md">
          <div className="flex items-center gap-3">
            <Radio size={16} className="text-muted-foreground" />
            <p className="text-sm text-foreground">
              {dashboardStats.stationsTotal - dashboardStats.stationsOnline} station(s) offline
            </p>
          </div>
          <a href="/admin/stations" className="text-sm text-muted-foreground hover:text-foreground">
            View
          </a>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat) => (
          <div key={stat.name} className="space-y-1">
            <p className="text-xs text-muted-foreground">{stat.name}</p>
            <p className="text-2xl font-medium text-foreground tabular-nums">{stat.value}</p>
            <p className="text-xs text-muted-foreground">
              {stat.change ? `${stat.change} vs last week` : 'Live from database'}
            </p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Revenue Chart */}
        <div>
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-sm font-medium text-foreground">Revenue</h2>
            <span className="text-xs text-muted-foreground">This week</span>
          </div>
          <div>
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
          </div>
        </div>

        {/* Funnel Chart */}
        <div>
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-sm font-medium text-foreground">Conversion Funnel</h2>
            <span className="text-xs text-muted-foreground">All time</span>
          </div>
          <div>
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
                    formatter={(value: number) => [
                      `${Number(value).toLocaleString()}`,
                      'Count',
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
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Recent Sessions */}
        <div className="lg:col-span-2">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-sm font-medium text-foreground">Recent Sessions</h2>
            <a href="/admin/sessions" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </a>
          </div>
          <div>
            {sessionsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Spinner />
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="pb-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          Session
                        </th>
                        <th className="pb-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          User
                        </th>
                        <th className="pb-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          Station
                        </th>
                        <th className="pb-3 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          Status
                        </th>
                        <th className="pb-3 text-right text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.map((session) => (
                        <tr key={session.id} className="border-t border-border/50">
                          <td className="py-3">
                            <p className="text-sm text-foreground font-mono">
                              {session.sessionCode}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatTime(new Date(session.startTime))}
                            </p>
                          </td>
                          <td className="py-3">
                            <p className="text-sm text-foreground">{session.userName || 'Anonymous'}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{session.userEmail}</p>
                          </td>
                          <td className="py-3 text-sm text-foreground">
                            {session.stationName}
                          </td>
                          <td className="py-3">
                            <StatusBadge status={session.status} size="sm" />
                          </td>
                          <td className="py-3 text-right">
                            <p className="text-sm text-foreground tabular-nums">
                              €{session.amountCharged.toFixed(2)}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-4">
                  {recentSessions.map((session) => (
                    <div key={session.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm text-foreground">
                          {session.sessionCode}
                        </span>
                        <StatusBadge status={session.status} size="sm" />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{session.userName || session.userEmail}</span>
                        <span className="text-foreground tabular-nums">€{session.amountCharged.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Station Health */}
        <div>
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="text-sm font-medium text-foreground">Station Health</h2>
            <a href="/admin/stations" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </a>
          </div>
          <div className="space-y-3">
            {stationsLoading ? (
              <div className="flex items-center justify-center h-32">
                <Spinner />
              </div>
            ) : (
              stationHealth.map((station) => (
                <div
                  key={station.id}
                  className="flex items-center justify-between py-3 border-b border-border/50 last:border-0"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm text-foreground">{station.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {station.availableSlots}/{station.totalSlots} slots
                    </p>
                  </div>
                  <StatusBadge status={station.status} size="sm" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      {dashboardStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-6 border-t border-border">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
            <p className="text-xl font-medium text-foreground tabular-nums">{dashboardStats.conversionRate}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Avg Duration</p>
            <p className="text-xl font-medium text-foreground tabular-nums">{dashboardStats.averageSessionDuration}m</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Deposits Held</p>
            <p className="text-xl font-medium text-foreground tabular-nums">€{dashboardStats.totalDepositsHeld}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Rewards Redeemed</p>
            <p className="text-xl font-medium text-foreground tabular-nums">{dashboardStats.totalRewardsRedeemed}</p>
          </div>
        </div>
      )}

      {/* Real-time Activity Feed */}
      <div>
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-sm font-medium text-foreground">Live Activity</h2>
          <span className="text-xs text-muted-foreground">Real-time</span>
        </div>
        <div className="space-y-0">
          {[
            { type: 'rental_start', user: 'alex@email.com', station: 'A-001', time: '2m' },
            { type: 'return', user: 'maria@email.com', station: 'B-003', time: '5m' },
            { type: 'reward', user: 'john@email.com', station: '-', time: '8m' },
            { type: 'rental_start', user: 'sam@email.com', station: 'A-002', time: '12m' },
            { type: 'return', user: 'lisa@email.com', station: 'C-001', time: '15m' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">
                  {activity.type === 'rental_start' && 'Rental started'}
                  {activity.type === 'return' && 'Power bank returned'}
                  {activity.type === 'reward' && 'Reward claimed'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activity.user}{activity.station !== '-' && ` · ${activity.station}`}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
