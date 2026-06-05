import 'server-only'

import { stationRepository, sessionRepository, campaignRepository } from '@/lib/db'
import { nullIfEmptyUuid } from '@/lib/db/schema-compat'
import type { CreateSessionData } from '@/lib/db/session-repository'
import crypto from 'crypto'

export interface PrepareRentalStartInput {
  userId: string
  stationId: string
  slotNumber: number
  campaignId?: string
  depositAmount: number
  hourlyRate: number
  dailyCap: number
  rewardThresholdMinutes?: number
  paymentIntentId?: string
  paymentAuthorizationId?: string
}

export interface PrepareRentalStartResult {
  session: Awaited<ReturnType<typeof sessionRepository.create>>
  unlockToken: string
  targetSlot: number
}

/**
 * Reserve slot + create pending session (shared by Stripe checkout and direct API start).
 */
export async function prepareRentalStart(
  input: PrepareRentalStartInput,
): Promise<PrepareRentalStartResult> {
  const slot = await stationRepository.getSlot(input.stationId, input.slotNumber)
  if (!slot || slot.status !== 'occupied') {
    throw new Error('SLOT_NOT_AVAILABLE')
  }

  const reserved = await stationRepository.reserveSlot(input.stationId, input.slotNumber)
  if (!reserved) {
    throw new Error('SLOT_RESERVE_FAILED')
  }

  const unlockToken = crypto.randomBytes(16).toString('hex')
  const unlockTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000)

  const createData: CreateSessionData = {
    userId: input.userId,
    campaignId: nullIfEmptyUuid(input.campaignId),
    pickupStationId: input.stationId,
    pickupSlotNumber: input.slotNumber,
    depositAmount: input.depositAmount,
    hourlyRate: input.hourlyRate,
    dailyCap: input.dailyCap,
    rewardThresholdMinutes: input.rewardThresholdMinutes ?? 60,
    paymentIntentId: input.paymentIntentId,
    paymentAuthorizationId: input.paymentAuthorizationId,
    unlockToken,
    unlockTokenExpiresAt,
  }

  try {
    const session = await sessionRepository.create(createData)
    return { session, unlockToken, targetSlot: input.slotNumber }
  } catch (error) {
    await stationRepository.updateSlot(input.stationId, input.slotNumber, { status: 'occupied' })
    throw error
  }
}

export async function loadCampaignPricing(campaignId?: string, stationCampaignId?: string | null) {
  let depositAmount = 25
  let hourlyRate = 2
  let dailyCap = 10
  let rewardThresholdMinutes = 60

  const normalizedCampaignId = campaignId?.trim() || undefined
  const normalizedStationCampaignId = stationCampaignId?.trim() || undefined
  let resolvedCampaignId: string | undefined = normalizedCampaignId

  const id = normalizedCampaignId || normalizedStationCampaignId
  if (id) {
    const campaign = await campaignRepository.getById(id)
    if (campaign?.is_active) {
      depositAmount = Number(campaign.deposit_amount)
      hourlyRate = Number(campaign.hourly_rate)
      dailyCap = Number(campaign.daily_cap)
      rewardThresholdMinutes = campaign.reward_threshold_minutes
      resolvedCampaignId = campaign.id
    }
  }

  return {
    depositAmount,
    hourlyRate,
    dailyCap,
    rewardThresholdMinutes,
    campaignId: resolvedCampaignId || undefined,
  }
}
