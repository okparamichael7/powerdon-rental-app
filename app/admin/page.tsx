'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { formatTime, formatNumber, formatDateTime } from '@/lib/utils';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminStatCard, AdminStatGrid } from '@/components/admin/admin-stat-card';
import { AdminErrorBanner, AdminEmptyState } from '@/components/admin/admin-states';
import {
  AdminChartSkeleton,
  AdminStatGridSkeleton,
  AdminTableSkeleton,
} from '@/components/admin/admin-skeletons';
import { StatusBadge } from '@/components/volt/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const { data: dashboardStats, loading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats();
  const { data: sessions, loading: sessionsLoading, error: sessionsError, fetchSessions } = useSessions();
  const { data: stations, loading: stationsLoading, error: stationsError, fetchStations } = useStations();

  const [revenueData, setRevenueData] = useState<{ date: string; revenue: number; sessions: number }[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelAnalytics['stages']>([]);
  const [activityFeed, setActivityFeed] = useState<
    { type: string; label: string; user: string; station: string; time: string }[]
  >([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    fetchSessions({ limit: 5 });
    fetchStations({ limit: 4 });
  }, [fetchSessions, fetchStations]);

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const [revenueRes, funnelRes, activityRes] = await Promise.all([
        analyticsService.getDailyRevenue({ days: 14 }),
        analyticsService.getFunnelAnalytics(),
        analyticsService.getRecentActivity(),
      ]);

      if (isSuccessResponse(revenueRes)) setRevenueData(revenueRes.data);
      else setAnalyticsError('Failed to load revenue data');

      if (isSuccessResponse(funnelRes)) setFunnelData(funnelRes.data.stages);
      if (isSuccessResponse(activityRes)) setActivityFeed(activityRes.data);

      setLastUpdated(new Date());
    } catch {
      setAnalyticsError('Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  useEffect(() => {
    if (!lastUpdated) return;
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const recentSessions = sessions?.slice(0, 5) || [];
  const stationHealth = stations?.slice(0, 4) || [];

  const chartFunnelData = funnelData.map((s) => ({
    stage: s.stage,
    count: s.count,
    percentage: Math.round(s.conversionRate),
  }));

  const handleRetry = () => {
    refetchStats();
    fetchSessions({ limit: 5 });
    fetchStations({ limit: 4 });
    loadAnalytics();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Overview"
        description="Monitor rental operations, revenue, and station health at a glance"
        meta={
          <p className="text-xs text-muted-foreground">
            {lastUpdated
              ? `Updated ${formatDistanceToNow(lastUpdated, { addSuffix: true })}`
              : statsLoading || analyticsLoading
                ? 'Loading…'
                : null}
          </p>
        }
      />

      {(statsError || sessionsError || stationsError || analyticsError) && (
        <AdminErrorBanner
          message={statsError || sessionsError || stationsError || analyticsError || 'Data load error'}
          onRetry={handleRetry}
        />
      )}

      {dashboardStats && dashboardStats.stationsOnline < dashboardStats.stationsTotal && (
        <div className="flex items-center justify-between rounded-md bg-muted px-4 py-3">
          <div className="flex items-center gap-3">
            <Radio size={16} className="text-muted-foreground" />
            <p className="text-sm text-foreground">
              {dashboardStats.stationsTotal - dashboardStats.stationsOnline} station(s) offline
            </p>
          </div>
          <Link href="/admin/stations" className="text-sm text-muted-foreground hover:text-foreground">
            View
          </Link>
        </div>
      )}

      {statsLoading && !dashboardStats ? (
        <AdminStatGridSkeleton />
      ) : dashboardStats ? (
        <AdminStatGrid columns={4}>
          <AdminStatCard
            label="Active Sessions"
            value={dashboardStats.activeSessions}
            icon={Zap}
          />
          <AdminStatCard
            label="Total Revenue"
            value={`€${formatNumber(dashboardStats.totalRevenue)}`}
            icon={Euro}
          />
          <AdminStatCard
            label="Rewards Issued"
            value={dashboardStats.totalRewardsIssued}
            icon={Gift}
          />
          <AdminStatCard
            label="Stations Online"
            value={`${dashboardStats.stationsOnline}/${dashboardStats.stationsTotal}`}
            icon={Radio}
          />
        </AdminStatGrid>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {analyticsLoading ? (
          <>
            <AdminChartSkeleton />
            <AdminChartSkeleton />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                <CardDescription>Last 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {revenueData.length === 0 ? (
                    <AdminEmptyState title="No revenue data yet" description="Completed rentals will appear here." />
                  ) : (
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
                          className="fill-muted-foreground text-xs"
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          className="fill-muted-foreground text-xs"
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
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversion Funnel</CardTitle>
                <CardDescription>All time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {funnelData.length === 0 ? (
                    <AdminEmptyState title="No funnel data yet" description="Conversion stages will appear as users interact with stations." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartFunnelData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          className="fill-muted-foreground text-xs"
                        />
                        <YAxis
                          type="category"
                          dataKey="stage"
                          axisLine={false}
                          tickLine={false}
                          className="fill-muted-foreground text-xs"
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
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Sessions</CardTitle>
            <Link href="/admin/sessions" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <AdminTableSkeleton rows={5} columns={5} />
            ) : recentSessions.length === 0 ? (
              <AdminEmptyState title="No sessions yet" description="Rental sessions will appear here as customers rent." />
            ) : (
              <>
                <div className="hidden md:block">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="pb-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Session
                        </th>
                        <th className="pb-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          User
                        </th>
                        <th className="pb-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Station
                        </th>
                        <th className="pb-3 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Status
                        </th>
                        <th className="pb-3 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSessions.map((session) => (
                        <tr key={session.id} className="border-t border-border/50">
                          <td className="py-3">
                            <p className="font-mono text-sm text-foreground">
                              {session.sessionCode}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatTime(new Date(session.startTime))}
                            </p>
                          </td>
                          <td className="py-3">
                            <p className="text-sm text-foreground">{session.userName || 'Anonymous'}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{session.userEmail}</p>
                          </td>
                          <td className="py-3 text-sm text-foreground">
                            {session.stationName}
                          </td>
                          <td className="py-3">
                            <StatusBadge status={session.status} size="sm" />
                          </td>
                          <td className="py-3 text-right">
                            <p className="text-sm tabular-nums text-foreground">
                              €{session.amountCharged.toFixed(2)}
                            </p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-4 md:hidden">
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
                        <span className="tabular-nums text-foreground">€{session.amountCharged.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Station Health</CardTitle>
            <Link href="/admin/stations" className="text-xs text-muted-foreground hover:text-foreground">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stationsLoading ? (
                <AdminTableSkeleton rows={4} columns={2} />
              ) : stationHealth.length === 0 ? (
                <AdminEmptyState title="No stations" description="Stations register when hardware connects." />
              ) : (
                stationHealth.map((station) => (
                  <div
                    key={station.id}
                    className="flex items-center justify-between border-b border-border/50 py-3 last:border-0"
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
          </CardContent>
        </Card>
      </div>

      {dashboardStats && (
        <AdminStatGrid columns={4}>
          <AdminStatCard
            label="Conversion Rate"
            value={`${dashboardStats.conversionRate}%`}
            variant="secondary"
          />
          <AdminStatCard
            label="Avg Duration"
            value={`${dashboardStats.averageSessionDuration}m`}
            variant="secondary"
          />
          <AdminStatCard
            label="Deposits Held"
            value={`€${dashboardStats.totalDepositsHeld}`}
            variant="secondary"
          />
          <AdminStatCard
            label="Rewards Redeemed"
            value={dashboardStats.totalRewardsRedeemed}
            variant="secondary"
          />
        </AdminStatGrid>
      )}

      <Card>
        <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Live Activity</CardTitle>
          <CardDescription>Real-time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            {analyticsLoading ? (
              <AdminTableSkeleton rows={4} columns={2} />
            ) : activityFeed.length === 0 ? (
              <AdminEmptyState title="No recent activity" />
            ) : (
              activityFeed.map((activity, index) => (
                <div key={`${activity.time}-${index}`} className="flex items-center justify-between border-b border-border/50 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{activity.label}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {activity.user}{activity.station !== '—' && ` · ${activity.station}`}
                    </p>
                  </div>
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(new Date(activity.time))}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
