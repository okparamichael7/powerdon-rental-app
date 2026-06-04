import { NextRequest, NextResponse } from 'next/server'
import { stationManager } from '@/lib/wscharge'
import { getWsChargeMetrics } from '@/lib/wscharge/metrics'
import { validateWsChargeConfig, getWsChargeConfig } from '@/lib/wscharge/config'
import { getSystemHealth } from '@/lib/ops/health'
import { withPublicApi } from '@/lib/api/public-route'

/**
 * Health check — Kubernetes-style readiness plus WsCharge integration status.
 */
export const GET = withPublicApi(async (_request: NextRequest) => {
  const connectedStations = stationManager.getConnectedStations()
  const wsConfig = validateWsChargeConfig()
  const cfg = getWsChargeConfig()
  const systemHealth = await getSystemHealth()

  const wschargeStatus = !cfg.enabled
    ? 'disabled'
    : wsConfig.valid
      ? connectedStations.length > 0
        ? 'healthy'
        : 'degraded'
      : 'unhealthy'

  const overall =
    systemHealth.status === 'unhealthy' || wschargeStatus === 'unhealthy'
      ? 'unhealthy'
      : systemHealth.status === 'degraded' || wschargeStatus === 'degraded'
        ? 'degraded'
        : 'healthy'

  return NextResponse.json({
    status: overall,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    components: systemHealth.components,
    wscharge: {
      status: wschargeStatus,
      enabled: cfg.enabled,
      protocolVersion: '5.8P',
      connectedStations: connectedStations.length,
      configErrors: wsConfig.errors,
      metrics: getWsChargeMetrics(),
    },
  })
}, 'health')
