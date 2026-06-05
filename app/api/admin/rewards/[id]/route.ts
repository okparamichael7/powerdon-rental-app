import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { rewardRepository } from '@/lib/db'
import { mapRewardFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  try {
    const { id } = await params
    const reward = await rewardRepository.getById(id)
    if (!reward) {
      return NextResponse.json({ success: false, error: 'Reward not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: mapRewardFromDb(reward) })
  } catch (error) {
    console.error('[Admin] reward detail:', error)
    return NextResponse.json({ success: false, error: 'Failed to load reward' }, { status: 500 })
  }
}
