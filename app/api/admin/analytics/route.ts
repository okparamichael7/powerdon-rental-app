import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { analyticsRepository } from '@/lib/db'

function parseAnalyticsType(request: NextRequest): string {
  const raw = request.nextUrl.searchParams.get('type') || 'dashboard'
  // Tolerate legacy malformed URLs: ?type=daily-revenue?days=14
  return raw.split('?')[0].split('&')[0]
}

function parseDays(request: NextRequest): number {
  let raw = request.nextUrl.searchParams.get('days')
  if (!raw) {
    const typeParam = request.nextUrl.searchParams.get('type') || ''
    const embedded = typeParam.match(/[?&]days=(\d+)/)
    if (embedded) raw = embedded[1]
  }
  const n = raw ? Number(raw) : 30
  return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 30
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const type = parseAnalyticsType(request)
  const days = parseDays(request)

  try {
    switch (type) {
      case 'dashboard': {
        const data = await analyticsRepository.getDashboardStats()
        return NextResponse.json({ success: true, data })
      }
      case 'daily-revenue': {
        const data = await analyticsRepository.getDailyRevenue(days)
        return NextResponse.json({ success: true, data })
      }
      case 'revenue': {
        const data = await analyticsRepository.getRevenueAnalytics(days)
        return NextResponse.json({ success: true, data })
      }
      case 'sessions': {
        const data = await analyticsRepository.getSessionAnalytics(days)
        return NextResponse.json({ success: true, data })
      }
      case 'rewards': {
        const data = await analyticsRepository.getRewardAnalytics(days)
        return NextResponse.json({ success: true, data })
      }
      case 'hourly': {
        const data = await analyticsRepository.getHourlyDistribution(days)
        return NextResponse.json({ success: true, data })
      }
      case 'duration': {
        const data = await analyticsRepository.getDurationDistribution(days)
        return NextResponse.json({ success: true, data })
      }
      case 'activity': {
        const data = await analyticsRepository.getRecentActivity(10)
        return NextResponse.json({ success: true, data })
      }
      case 'funnel': {
        const stages = await analyticsRepository.getFunnel()
        const funnel = {
          stages: stages.map((s, i) => ({
            stage: s.stage,
            count: s.count,
            conversionRate: i === 0 || !stages[i - 1].count ? 100 : (s.count / stages[i - 1].count) * 100,
          })),
          overallConversion:
            stages[0]?.count > 0 ? ((stages[stages.length - 1]?.count ?? 0) / stages[0].count) * 100 : 0,
        }
        return NextResponse.json({ success: true, data: funnel })
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown analytics type' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Admin] analytics:', error)
    return NextResponse.json({ success: false, error: 'Analytics failed' }, { status: 500 })
  }
}
