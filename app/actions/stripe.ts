'use server'

import { createCheckoutSession, getOrCreateCustomer, getCheckoutSession } from '@/lib/stripe/payment-service'
import { DEFAULT_PRICING, generateIdempotencyKey } from '@/lib/stripe/types'
import { createServiceClient } from '@/lib/supabase/admin'
import { userRepository, sessionRepository, stationRepository } from '@/lib/db'
import { prepareRentalStart, loadCampaignPricing } from '@/lib/rental/start-orchestrator'
import type { DbUser, DbRentalSession } from '@/lib/db/types'
import { getErrorDetails, getErrorMessage } from '@/lib/errors/get-error-message'
import { logger } from '@/lib/observability/logger'

export interface StartRentalCheckoutParams {
  email: string
  name?: string
  stationId: string
  slotNumber?: number
  campaignId?: string
}

export interface StartRentalCheckoutResult {
  success: boolean
  clientSecret?: string
  sessionCode?: string
  sessionId?: string
  unlockToken?: string
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

    const station = await stationRepository.getById(params.stationId)
    const pricing = await loadCampaignPricing(params.campaignId, station?.campaign_id ?? null)
    const depositAmount = Math.round(pricing.depositAmount * 100) || DEFAULT_PRICING.preAuthAmountCents

    let targetSlot = params.slotNumber
    if (!targetSlot) {
      const availableSlot = await stationRepository.getAvailableSlot(params.stationId)
      if (!availableSlot) {
        return { success: false, error: 'No power banks available at this station' }
      }
      targetSlot = availableSlot.slot_number
    }

    let createdSession: DbRentalSession
    let unlockToken: string
    try {
      const prepared = await prepareRentalStart({
        userId,
        stationId: params.stationId,
        slotNumber: targetSlot,
        campaignId: pricing.campaignId,
        depositAmount: pricing.depositAmount,
        hourlyRate: pricing.hourlyRate,
        dailyCap: pricing.dailyCap,
        rewardThresholdMinutes: pricing.rewardThresholdMinutes,
      })
      createdSession = prepared.session
      unlockToken = prepared.unlockToken
    } catch (prepError) {
      const prepMessage = getErrorMessage(prepError)
      if (prepMessage === 'SLOT_NOT_AVAILABLE' || prepMessage === 'SLOT_RESERVE_FAILED') {
        return { success: false, error: 'No power banks available at this station' }
      }
      logger.error('Failed to prepare rental session', {
        error: prepMessage,
        errorDetails: getErrorDetails(prepError),
        stationId: params.stationId,
        slotNumber: targetSlot,
      })
      const userMessage =
        prepMessage.includes('schema cache') || prepMessage.includes('does not exist')
          ? 'Rental system is updating. Please try again in a moment or contact support.'
          : 'Failed to create rental session'
      return { success: false, error: userMessage }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const sessionCode = createdSession.session_code

    const checkoutResult = await createCheckoutSession({
      customerId: customer.id,
      customerEmail: params.email,
      sessionId: sessionCode,
      userId,
      stationId: params.stationId,
      slotNumber: targetSlot,
      campaignId: params.campaignId,
      depositAmountCents: depositAmount,
      successUrl: `${baseUrl}/?session=${sessionCode}`,
      cancelUrl: `${baseUrl}/?cancel=${sessionCode}`,
    })

    return {
      success: true,
      clientSecret: checkoutResult.clientSecret,
      sessionCode,
      sessionId: createdSession.id,
      unlockToken,
    }
  } catch (error) {
    const message = getErrorMessage(error)
    logger.error('Error starting rental checkout', {
      error: message,
      errorDetails: getErrorDetails(error),
      params: { ...params, email: '[REDACTED]' },
    })
    return {
      success: false,
      error: message || 'Failed to start checkout',
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
