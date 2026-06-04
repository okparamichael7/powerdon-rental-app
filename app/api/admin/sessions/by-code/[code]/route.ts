import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { sessionRepository } from '@/lib/db'
import { mapSessionFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const { code } = await params
  try {
    const session = await sessionRepository.getByCode(decodeURIComponent(code))
    if (!session) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: mapSessionFromDb(session) })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load session' }, { status: 500 })
  }
}
