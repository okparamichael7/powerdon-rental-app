import { NextRequest, NextResponse } from 'next/server'
import { requireAdminSession } from '@/lib/api/route-helpers'
import { campaignRepository } from '@/lib/db'
import { mapCampaignFromDb } from '@/lib/mappers/domain-mappers'

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
  const body = await request.json()
  const updated = await campaignRepository.update(id, {
    name: body.name,
    event_name: body.eventName,
    start_date: body.startDate,
    end_date: body.endDate,
    hourly_rate: body.hourlyRate != null ? Number(body.hourlyRate) : undefined,
    daily_cap: body.dailyCap != null ? Number(body.dailyCap) : undefined,
    deposit_amount: body.depositAmount != null ? Number(body.depositAmount) : undefined,
    reward_threshold_minutes: body.rewardThresholdMinutes != null ? Number(body.rewardThresholdMinutes) : undefined,
    reward_type: body.rewardType,
    reward_value: body.rewardValue != null ? Number(body.rewardValue) : undefined,
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
