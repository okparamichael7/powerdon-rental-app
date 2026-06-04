import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { sessionRepository } from '@/lib/db'
import { mapSessionFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const email = request.nextUrl.searchParams.get('email')
  if (!email) {
    return NextResponse.json({ success: false, error: 'email required' }, { status: 400 })
  }

  try {
    const session = await sessionRepository.getActiveByUserEmail(email)
    return NextResponse.json({
      success: true,
      data: session ? mapSessionFromDb(session) : null,
    })
  } catch (error) {
    console.error('[Admin] active session:', error)
    return NextResponse.json({ success: false, error: 'Failed to load session' }, { status: 500 })
  }
}
