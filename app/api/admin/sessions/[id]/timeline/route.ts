import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { sessionRepository } from '@/lib/db'
import { mapTimelineFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  try {
    const events = await sessionRepository.getEvents(id)
    return NextResponse.json({ success: true, data: events.map(mapTimelineFromDb) })
  } catch (error) {
    console.error('[Admin] session timeline:', error)
    return NextResponse.json({ success: false, error: 'Failed to load timeline' }, { status: 500 })
  }
}
