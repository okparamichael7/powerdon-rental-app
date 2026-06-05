import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { getProductionEnvChecks, productionEnvReady } from '@/lib/env/production-check'
import { analyticsRepository } from '@/lib/db'
import { buildHealthResponse } from '@/lib/ops/health-response'

const EMPTY_STATS = {
  activeSessions: 0,
  totalSessions: 0,
  stationsOnline: 0,
  stationsTotal: 0,
}

/**
 * Staff-authenticated ops snapshot (health + env checks).
 * Metrics remain on /api/metrics with METRICS_API_KEY for external scrapers.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  try {
    let health: Awaited<ReturnType<typeof buildHealthResponse>> | null = null
    try {
      health = await buildHealthResponse()
    } catch (error) {
      console.error('[Admin] ops health:', error)
    }

    let stats = { ...EMPTY_STATS }
    try {
      const dashboard = await analyticsRepository.getDashboardStats()
      stats = {
        activeSessions: dashboard.activeSessions,
        totalSessions: dashboard.totalSessions,
        stationsOnline: dashboard.stationsOnline,
        stationsTotal: dashboard.stationsTotal,
      }
    } catch (error) {
      console.error('[Admin] ops dashboard stats:', error)
    }

    return NextResponse.json({
      success: true,
      data: {
        health,
        productionReady: productionEnvReady(),
        envChecks: getProductionEnvChecks(),
        ...stats,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[Admin] ops:', error)
    return NextResponse.json({ success: false, error: 'Failed to load ops data' }, { status: 500 })
  }
}
