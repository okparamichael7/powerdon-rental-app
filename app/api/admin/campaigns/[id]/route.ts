import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { campaignRepository } from '@/lib/db'
import { mapCampaignFromDb } from '@/lib/mappers/domain-mappers'
import { validateBody, schemas } from '@/lib/security/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response
  const { id } = await params
  const campaign = await campaignRepository.getById(id)
  if (!campaign) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
  return NextResponse.json({ success: true, data: mapCampaignFromDb(campaign) })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response
  const { id } = await params
  const validated = await validateBody(request, schemas.updateCampaign)
  if (!validated.success) return validated.error
  const body = validated.data
  const updated = await campaignRepository.update(id, {
    name: body.name,
    event_name: body.eventName,
    start_date: body.startDate?.toISOString(),
    end_date: body.endDate?.toISOString(),
    hourly_rate: body.hourlyRate,
    daily_cap: body.dailyCap,
    deposit_amount: body.depositAmount,
    reward_threshold_minutes: body.rewardThresholdMinutes,
    reward_type: body.rewardType,
    reward_value: body.rewardValue,
    reward_description: body.rewardDescription,
    is_active: body.isActive,
  })
  return NextResponse.json({ success: true, data: mapCampaignFromDb(updated) })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession(request)
  if (!auth.ok) return auth.response
  const { id } = await params
  await campaignRepository.update(id, { is_active: false })
  return NextResponse.json({ success: true, data: null })
}
