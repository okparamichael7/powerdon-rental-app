import { NextRequest, NextResponse } from 'next/server'
import { rewardRepository } from '@/lib/db'
import { enforceRateLimit } from '@/lib/api/route-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = enforceRateLimit(request, 'api')
  if (rateLimited) return rateLimited

  const { id } = await params
  try {
    const body = await request.json().catch(() => ({}))
    const reward = await rewardRepository.redeem(id, {
      redemptionLocation: body.location || 'PWA',
    })
    return NextResponse.json({ success: true, data: reward })
  } catch (error) {
    console.error('[API] redeem reward:', error)
    return NextResponse.json({ success: false, error: 'Failed to redeem reward' }, { status: 500 })
  }
}
