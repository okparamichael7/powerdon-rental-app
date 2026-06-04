import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { analyticsRepository } from '@/lib/db'

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const type = request.nextUrl.searchParams.get('type') || 'dashboard'

  try {
    switch (type) {
      case 'dashboard': {
        const data = await analyticsRepository.getDashboardStats()
        return NextResponse.json({ success: true, data })
      }
      case 'daily-revenue': {
        const data = await analyticsRepository.getDailyRevenue()
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
