'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { AdminStatCard, AdminStatGrid } from '@/components/admin/admin-stat-card';
import { AdminErrorBanner } from '@/components/admin/admin-states';
import { AdminPageSkeleton } from '@/components/admin/admin-skeletons';
import { StatusBadge } from '@/components/volt/status-badge';
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

interface WsChargeHealth {
  status: string;
  enabled?: boolean;
  protocolVersion?: string;
  connectedStations: number;
  stations?: StationStatus[];
  configErrors?: string[];
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  components: ComponentHealth[];
  wscharge?: WsChargeHealth;
  productionReady?: boolean;
}

interface EnvCheck {
  name: string;
  ok: boolean;
  required: boolean;
}

interface OpsSnapshot {
  productionReady: boolean;
  envChecks: EnvCheck[];
  activeSessions: number;
  totalSessions: number;
  stationsOnline: number;
  stationsTotal: number;
}

export default function OpsPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [ops, setOps] = useState<OpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const opsRes = await fetch('/api/admin/ops', { credentials: 'include' });
      if (!opsRes.ok) {
        throw new Error('Failed to load ops data');
      }
      const opsBody = await opsRes.json();
      if (opsBody.success && opsBody.data) {
        if (opsBody.data.health) setHealth(opsBody.data.health as SystemHealth);
        setOps({
          productionReady: Boolean(opsBody.data.productionReady),
          envChecks: opsBody.data.envChecks ?? [],
          activeSessions: Number(opsBody.data.activeSessions ?? 0),
          totalSessions: Number(opsBody.data.totalSessions ?? 0),
          stationsOnline: Number(opsBody.data.stationsOnline ?? 0),
          stationsTotal: Number(opsBody.data.stationsTotal ?? 0),
        });
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

  if (loading && !health && !ops) {
    return <AdminPageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Operations"
        description="System health, component status, and production readiness monitoring"
        actions={
          <>
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
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <AdminErrorBanner message={error} onRetry={fetchData} />
      )}

      <AdminStatGrid columns={4}>
        <AdminStatCard
          label="System Status"
          value={
            <span className="flex items-center gap-2 capitalize">
              {health && getStatusIcon(health.status)}
              {health?.status || 'Unknown'}
            </span>
          }
          description={`Version ${health?.version || '-'}`}
          icon={Activity}
        />
        <AdminStatCard
          label="Uptime"
          value={health ? formatUptime(health.uptime) : '-'}
          description="Since last restart"
          icon={Clock}
        />
        <AdminStatCard
          label="Connected Stations"
          value={health?.wscharge?.connectedStations ?? 0}
          description="Active connections"
          icon={Wifi}
        />
        <AdminStatCard
          label="Active Sessions"
          value={ops?.activeSessions ?? 0}
          description={`From database (${ops?.totalSessions ?? 0} total)`}
          icon={Cpu}
        />
      </AdminStatGrid>

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
                className="flex items-center justify-between rounded-lg border p-4"
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
                  <StatusBadge status={component.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Production readiness</CardTitle>
          <CardDescription>
            {ops?.productionReady ? 'All required checks pass' : 'Some required production env vars are missing'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(ops?.envChecks ?? []).map((check) => (
              <div key={check.name} className="flex items-center justify-between border-b py-2 last:border-0">
                <span className="text-sm">{check.name}</span>
                <Badge variant={check.ok ? 'default' : check.required ? 'destructive' : 'secondary'}>
                  {check.ok ? 'OK' : check.required ? 'Missing' : 'Optional'}
                </Badge>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Prometheus metrics: configure <code className="text-xs">METRICS_API_KEY</code> and scrape{' '}
            <code className="text-xs">/api/metrics</code> externally.
          </p>
        </CardContent>
      </Card>

      {health?.wscharge?.stations && health.wscharge.stations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected Stations</CardTitle>
            <CardDescription>
              Real-time station connection status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {health.wscharge.stations.map((station) => (
                <div
                  key={station.deviceId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Wifi className="h-4 w-4 text-green-500" />
                    <span className="font-mono text-sm">{station.deviceId}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      Last heartbeat: {new Date(station.lastHeartbeat).toLocaleTimeString()}
                    </span>
                    <StatusBadge status={station.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Last updated: {health?.timestamp ? new Date(health.timestamp).toLocaleString() : '-'}
      </p>
    </div>
  );
}
