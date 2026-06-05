import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { getProductionEnvChecks, productionEnvReady } from '@/lib/env/production-check'
import { analyticsRepository } from '@/lib/db'

/**
 * Staff-authenticated ops snapshot (health + env checks).
 * Metrics remain on /api/metrics with METRICS_API_KEY for external scrapers.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const origin = request.nextUrl.origin
  let health: Record<string, unknown> | null = null
  try {
    const res = await fetch(`${origin}/api/health`, { cache: 'no-store' })
    if (res.ok) health = await res.json()
  } catch {
    health = null
  }

  const dashboard = await analyticsRepository.getDashboardStats()

  return NextResponse.json({
    success: true,
    data: {
      health,
      productionReady: productionEnvReady(),
      envChecks: getProductionEnvChecks(),
      activeSessions: dashboard.activeSessions,
      totalSessions: dashboard.totalSessions,
      stationsOnline: dashboard.stationsOnline,
      stationsTotal: dashboard.stationsTotal,
      timestamp: new Date().toISOString(),
    },
  })
}
