'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Server,
  Database,
  Wifi,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Clock,
  Cpu,
  HardDrive,
} from 'lucide-react';

interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  lastCheck: string;
}

interface StationStatus {
  deviceId: string;
  status: string;
  lastHeartbeat: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  components: ComponentHealth[];
  services: {
    stationProxy: {
      status: string;
      connectedStations: number;
      stations: StationStatus[];
    };
  };
}

interface MetricsData {
  timestamp: string;
  counters: Record<string, Array<{ value: number; labels: Record<string, string> }>>;
  gauges: Record<string, Array<{ value: number; labels: Record<string, string> }>>;
}

export default function OpsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, metricsRes] = await Promise.all([
        fetch('/api/health'),
        fetch('/api/metrics?format=json'),
      ]);

      if (healthRes.ok) {
        setHealth(await healthRes.json());
      }

      if (metricsRes.ok) {
        setMetrics(await metricsRes.json());
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchData, autoRefresh]);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      healthy: 'default',
      degraded: 'secondary',
      unhealthy: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getMetricValue = (
    type: 'counters' | 'gauges',
    name: string,
    labels?: Record<string, string>
  ): number => {
    if (!metrics) return 0;
    const metricData = metrics[type]?.[name];
    if (!metricData) return 0;

    if (!labels) {
      return metricData.reduce((sum, m) => sum + m.value, 0);
    }

    const match = metricData.find(m =>
      Object.entries(labels).every(([k, v]) => m.labels[k] === v)
    );
    return match?.value || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Operations Dashboard</h1>
          <p className="text-muted-foreground">
            System health and metrics monitoring
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Pause' : 'Resume'} Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Status Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {health && getStatusIcon(health.status)}
              <span className="text-2xl font-bold capitalize">
                {health?.status || 'Unknown'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Version {health?.version || '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health ? formatUptime(health.uptime) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Since last restart
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Stations</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.services.stationProxy.connectedStations || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Active connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getMetricValue('gauges', 'rental_sessions_active')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ongoing rentals
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Component Health */}
      <Card>
        <CardHeader>
          <CardTitle>Component Health</CardTitle>
          <CardDescription>
            Status of individual system components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {health?.components.map((component) => (
              <div
                key={component.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  {component.name === 'database' && <Database className="h-5 w-5" />}
                  {component.name === 'tcp-proxy' && <Server className="h-5 w-5" />}
                  {component.name === 'payment-service' && <HardDrive className="h-5 w-5" />}
                  <div>
                    <p className="font-medium capitalize">{component.name.replace('-', ' ')}</p>
                    {component.message && (
                      <p className="text-sm text-muted-foreground">{component.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {component.latency !== undefined && (
                    <span className="text-sm text-muted-foreground">
                      {component.latency}ms
                    </span>
                  )}
                  {getStatusBadge(component.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Request Metrics</CardTitle>
            <CardDescription>HTTP request statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Requests</span>
                <span className="font-medium">
                  {getMetricValue('counters', 'http_requests_total')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Successful (2xx)</span>
                <span className="font-medium text-green-600">
                  {getMetricValue('counters', 'http_requests_total', { status: '200' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client Errors (4xx)</span>
                <span className="font-medium text-yellow-600">
                  {getMetricValue('counters', 'http_requests_total', { status: '400' }) +
                   getMetricValue('counters', 'http_requests_total', { status: '401' }) +
                   getMetricValue('counters', 'http_requests_total', { status: '404' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Server Errors (5xx)</span>
                <span className="font-medium text-red-600">
                  {getMetricValue('counters', 'http_requests_total', { status: '500' })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Metrics</CardTitle>
            <CardDescription>Rental session statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Sessions</span>
                <span className="font-medium">
                  {getMetricValue('counters', 'rental_sessions_total')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed</span>
                <span className="font-medium text-green-600">
                  {getMetricValue('counters', 'rental_sessions_total', { status: 'completed' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Failed</span>
                <span className="font-medium text-red-600">
                  {getMetricValue('counters', 'rental_sessions_total', { status: 'failed' })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium text-blue-600">
                  {getMetricValue('gauges', 'rental_sessions_active')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connected Stations */}
      {health?.services.stationProxy.stations && health.services.stationProxy.stations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Stations</CardTitle>
            <CardDescription>
              Real-time station connection status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {health.services.stationProxy.stations.map((station) => (
                <div
                  key={station.deviceId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="font-mono text-sm">{station.deviceId}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      Last heartbeat: {new Date(station.lastHeartbeat).toLocaleTimeString()}
                    </span>
                    <Badge variant="outline">{station.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : '-'}
      </div>
    </div>
  );
}
