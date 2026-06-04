import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { campaignRepository } from '@/lib/db'
import { mapCampaignFromDb } from '@/lib/mappers/domain-mappers'

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  try {
    const params = request.nextUrl.searchParams
    const isActive = params.get('isActive')
    const campaigns = await campaignRepository.getAll({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search: params.get('search') || undefined,
    })
    return NextResponse.json({
      success: true,
      data: campaigns.map((c) => mapCampaignFromDb(c)),
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to load campaigns' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response

  try {
    const body = await request.json()
    const created = await campaignRepository.create({
      name: body.name,
      eventName: body.eventName,
      startDate: body.startDate,
      endDate: body.endDate,
      hourlyRate: Number(body.hourlyRate),
      dailyCap: Number(body.dailyCap),
      depositAmount: Number(body.depositAmount),
      rewardThresholdMinutes: Number(body.rewardThresholdMinutes),
      rewardType: body.rewardType || 'voucher',
      rewardValue: Number(body.rewardValue),
      rewardDescription: body.rewardDescription,
      isActive: body.isActive ?? true,
    })
    return NextResponse.json({ success: true, data: mapCampaignFromDb(created) }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to create campaign' }, { status: 500 })
  }
}
