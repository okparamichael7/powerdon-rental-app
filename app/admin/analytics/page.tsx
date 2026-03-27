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
import { Download, TrendingUp, Clock, Zap, Euro, Gift, RefreshCw, AlertCircle } from "lucide-react"
import { formatNumber } from '@/lib/utils';
import { analyticsService } from '@/lib/services';
import { isSuccessResponse } from '@/lib/api/client';
import type { 
  RevenueAnalytics, 
  SessionAnalytics, 
  RewardAnalytics, 
  FunnelAnalytics 
} from '@/lib/api/types';

// Duration distribution (static for now - could be computed from session analytics)
const durationDistribution = [
  { name: "< 30 min", value: 15, color: "#e5e7eb" },
  { name: "30-60 min", value: 25, color: "#93c5fd" },
  { name: "1-2 hrs", value: 35, color: "#3b82f6" },
  { name: "2-4 hrs", value: 18, color: "#1d4ed8" },
  { name: "> 4 hrs", value: 7, color: "#1e3a8a" },
];

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Analytics data
  const [revenueData, setRevenueData] = useState<RevenueAnalytics | null>(null);
  const [sessionData, setSessionData] = useState<SessionAnalytics | null>(null);
  const [rewardData, setRewardData] = useState<RewardAnalytics | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelAnalytics | null>(null);
  const [hourlyData, setHourlyData] = useState<{ hour: string; count: number }[]>([]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [revenueRes, sessionRes, rewardRes, funnelRes, hourlyRes] = await Promise.all([
        analyticsService.getRevenueAnalytics(),
        analyticsService.getSessionAnalytics(),
        analyticsService.getRewardAnalytics(),
        analyticsService.getFunnelAnalytics(),
        analyticsService.getHourlyDistribution(),
      ]);
      
      if (isSuccessResponse(revenueRes)) setRevenueData(revenueRes.data);
      if (isSuccessResponse(sessionRes)) setSessionData(sessionRes.data);
      if (isSuccessResponse(rewardRes)) setRewardData(rewardRes.data);
      if (isSuccessResponse(funnelRes)) setFunnelData(funnelRes.data);
      if (isSuccessResponse(hourlyRes)) setHourlyData(hourlyRes.data);
    } catch (err) {
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, timeRange]);

  // Loading state
  if (loading && !revenueData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Spinner className="w-8 h-8 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !revenueData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Failed to Load Analytics</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchAnalytics}>
                <RefreshCw size={16} className="mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Format duration from minutes
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">Deep dive into platform performance</p>
        </div>
        <div className="flex gap-2">
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
          <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Euro className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +23%
              </span>
            </div>
            <p className="text-xl font-semibold text-foreground">
              {revenueData ? `€${formatNumber(revenueData.totalRevenue)}` : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +18%
              </span>
            </div>
            <p className="text-xl font-semibold text-foreground">
              {sessionData ? formatNumber(sessionData.totalSessions) : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Total Rentals</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +5%
              </span>
            </div>
            <p className="text-xl font-semibold text-foreground">
              {sessionData ? formatDuration(sessionData.averageDuration) : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Avg Duration</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Gift className="h-5 w-5 text-muted-foreground" />
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                +12%
              </span>
            </div>
            <p className="text-xl font-semibold text-foreground">
              {rewardData ? `${rewardData.redemptionRate.toFixed(0)}%` : '-'}
            </p>
            <p className="text-xs text-muted-foreground">Reward Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue & Rentals */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Revenue & Rentals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
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
            </div>
          </CardContent>
        </Card>

        {/* Hourly Usage Pattern */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Hourly Usage Pattern</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Duration Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Duration Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
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
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {durationDistribution.map((item) => (
                <div key={item.name} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-muted-foreground">{item.name}</span>
                  <span className="font-medium ml-auto">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Station Performance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">Station Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
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
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel */}
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
                <p className="text-xs text-muted-foreground">Scan -&gt; Info</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">
                  {funnelData.stages[2] && funnelData.stages[1] ? ((funnelData.stages[2].count / funnelData.stages[1].count) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Info -&gt; Payment</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">
                  {funnelData.stages[3] && funnelData.stages[2] ? ((funnelData.stages[3].count / funnelData.stages[2].count) * 100).toFixed(0) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Payment -&gt; Rental</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">{funnelData.overallConversion.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Overall Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
