import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { stationRepository } from '@/lib/db'
import { getWsChargeMetrics } from '@/lib/wscharge/metrics'

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const stationId = request.nextUrl.searchParams.get('stationId')
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 200)

  if (!stationId) {
    return NextResponse.json(
      { success: false, error: 'stationId query parameter is required' },
      { status: 400 }
    )
  }

  const events = await stationRepository.getHardwareEvents(stationId, limit)

  return NextResponse.json({
    success: true,
    data: events,
    metrics: getWsChargeMetrics(),
  })
}
