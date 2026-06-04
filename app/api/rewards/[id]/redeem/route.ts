import { NextRequest, NextResponse } from 'next/server'
import { rewardRepository } from '@/lib/db'
import { enforceRateLimit, requireAdminSession } from '@/lib/api/route-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimited = await enforceRateLimit(request, 'api')
  if (rateLimited) return rateLimited

  const { id } = await params
  try {
    const body = await request.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code.trim() : ''

    const existing = await rewardRepository.getById(id)
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Reward not found' }, { status: 404 })
    }

    const adminGate = await requireAdminSession(request)
    if (!adminGate.ok) {
      if (!code || existing.code.toUpperCase() !== code.toUpperCase()) {
        return NextResponse.json(
          { success: false, error: 'Valid reward code is required', code: 'INVALID_REWARD_CODE' },
          { status: 403 },
        )
      }
    }

    const reward = await rewardRepository.redeem(id, {
      redemptionLocation: body.location || 'PWA',
      redeemedByStaffId: adminGate.ok ? adminGate.auth.userId : undefined,
    })
    return NextResponse.json({ success: true, data: reward })
  } catch (error) {
    console.error('[API] redeem reward:', error)
    return NextResponse.json({ success: false, error: 'Failed to redeem reward' }, { status: 500 })
  }
}
