import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { sessionRepository } from '@/lib/db'
import { mapSessionFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  try {
    const params = request.nextUrl.searchParams
    const status = params.get('status')?.split(',').filter(Boolean) as import('@/lib/db/types').SessionStatus[] | undefined
    const sessions = await sessionRepository.getAll({
      status: status?.length ? status : undefined,
      search: params.get('search') || undefined,
      stationId: params.get('stationId') || undefined,
      campaignId: params.get('campaignId') || undefined,
      limit: params.get('limit') ? Number(params.get('limit')) : 100,
    })

    return NextResponse.json({
      success: true,
      data: sessions.map((s) => mapSessionFromDb(s)),
      meta: { total: sessions.length },
    })
  } catch (error) {
    console.error('[Admin] sessions list:', error)
    return NextResponse.json({ success: false, error: 'Failed to load sessions' }, { status: 500 })
  }
}
