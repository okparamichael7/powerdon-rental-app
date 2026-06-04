'use server'

import { createCheckoutSession, getOrCreateCustomer, getCheckoutSession } from '@/lib/stripe/payment-service'
import { DEFAULT_PRICING, generateIdempotencyKey } from '@/lib/stripe/types'
import { createServiceClient } from '@/lib/supabase/admin'
import { userRepository, sessionRepository, campaignRepository } from '@/lib/db'
import type { DbUser, DbRentalSession } from '@/lib/db/types'
import { logger } from '@/lib/observability/logger'

export interface StartRentalCheckoutParams {
  email: string
  name?: string
  stationId: string
  slotNumber: number
  campaignId?: string
}

export interface StartRentalCheckoutResult {
  success: boolean
  clientSecret?: string
  sessionCode?: string
  error?: string
}

export async function startRentalCheckout(
  params: StartRentalCheckoutParams,
): Promise<StartRentalCheckoutResult> {
  const span = logger.startSpan('actions.startRentalCheckout')

  try {
    const customer = await getOrCreateCustomer({
      email: params.email,
      name: params.name,
      metadata: { source: 'rental_checkout' },
    })

    const dbUser = await userRepository.getOrCreate(params.email, { name: params.name })
    const userId = dbUser.id

    let depositAmount = DEFAULT_PRICING.preAuthAmountCents
    let hourlyRate = 200
    let dailyCap = DEFAULT_PRICING.dailyCapAmountCents / 100

    if (params.campaignId) {
      const campaign = await campaignRepository.getById(params.campaignId)
      if (campaign?.is_active) {
        depositAmount = Math.round(Number(campaign.deposit_amount) * 100)
        hourlyRate = Math.round(Number(campaign.hourly_rate) * 100)
        dailyCap = Number(campaign.daily_cap)
      }
    }

    const sessionCode = generateSessionCode()

    try {
      await sessionRepository.create({
        userId,
        campaignId: params.campaignId,
        pickupStationId: params.stationId,
        pickupSlotNumber: params.slotNumber,
        depositAmount: depositAmount / 100,
        hourlyRate: hourlyRate / 100,
        dailyCap,
        rewardThresholdMinutes: 60,
      })
    } catch {
      return { success: false, error: 'Failed to create rental session' }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const checkoutResult = await createCheckoutSession({
      customerId: customer.id,
      customerEmail: params.email,
      sessionId: sessionCode,
      userId,
      stationId: params.stationId,
      slotNumber: params.slotNumber,
      campaignId: params.campaignId,
      depositAmountCents: depositAmount,
      successUrl: `${baseUrl}/?session=${sessionCode}`,
      cancelUrl: `${baseUrl}/?cancel=${sessionCode}`,
    })

    return {
      success: true,
      clientSecret: checkoutResult.clientSecret,
      sessionCode,
    }
  } catch (error) {
    logger.error('Error starting rental checkout', {
      error: error instanceof Error ? error : String(error),
      params,
    })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start checkout',
    }
  } finally {
    span.end()
  }
}

export async function getCheckoutStatus(sessionCode: string) {
  try {
    const session = await sessionRepository.getByCode(sessionCode)

    if (!session) {
      return { status: 'failed' as const, error: 'Session not found' }
    }

    if (session.status === 'active' || session.payment_status === 'authorized') {
      return { status: 'completed' as const, paymentStatus: session.payment_status }
    }
    if (session.status === 'failed' || session.payment_status === 'failed') {
      return { status: 'failed' as const, paymentStatus: session.payment_status }
    }
    if (session.status === 'cancelled') {
      return { status: 'expired' as const, paymentStatus: session.payment_status }
    }
    return { status: 'pending' as const, paymentStatus: session.payment_status }
  } catch {
    return { status: 'failed' as const, error: 'Failed to get checkout status' }
  }
}

export async function cancelCheckout(sessionCode: string) {
  try {
    const session = await sessionRepository.getByCode(sessionCode)
    if (!session) return { success: false, error: 'Session not found' }
    await sessionRepository.updateStatus(session.id, 'cancelled')
    return { success: true }
  } catch {
    return { success: false, error: 'Failed to cancel checkout' }
  }
}

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = 'VR-'
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Re-export for checkout component
export { getCheckoutSession }
