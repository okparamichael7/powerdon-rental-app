import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { rewardRepository, sessionRepository, campaignRepository } from '@/lib/db'
import { mapRewardFromDb } from '@/lib/mappers/domain-mappers'

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { sessionId, campaignId } = body as { sessionId?: string; campaignId?: string }

  if (!sessionId || !campaignId) {
    return NextResponse.json({ success: false, error: 'sessionId and campaignId required' }, { status: 400 })
  }

  try {
    const session = await sessionRepository.getById(sessionId)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 })
    }
    const campaign = await campaignRepository.getById(campaignId)
    if (!campaign) {
      return NextResponse.json({ success: false, error: 'Campaign not found' }, { status: 404 })
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    const reward = await rewardRepository.create({
      sessionId,
      userId: session.user_id,
      campaignId,
      rewardType: campaign.reward_type ?? 'voucher',
      value: Number(campaign.reward_value ?? 0),
      description: campaign.reward_description ?? undefined,
      expiresAt,
    })

    const issued = await rewardRepository.issue(reward.id)
    return NextResponse.json({ success: true, data: mapRewardFromDb(issued) }, { status: 201 })
  } catch (error) {
    console.error('[Admin] issue reward:', error)
    return NextResponse.json({ success: false, error: 'Failed to issue reward' }, { status: 500 })
  }
}
