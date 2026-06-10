'use server'

import {
  createCheckoutSession,
  getOrCreateCustomer,
  getCheckoutSession,
  getPaymentIntent,
} from '@/lib/stripe/payment-service'
import { updateRentalSessionFromWebhook } from '@/lib/stripe/webhook-persistence'
import { DEFAULT_PRICING, generateIdempotencyKey } from '@/lib/stripe/types'
import { createServiceClient } from '@/lib/supabase/admin'
import { userRepository, sessionRepository, stationRepository } from '@/lib/db'
import { prepareRentalStart, loadCampaignPricing } from '@/lib/rental/start-orchestrator'
import { dispatchBorrowBySessionCode } from '@/lib/rental/dispatch-borrow'
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
  checkoutSessionId?: string
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
    const pricing = await loadCampaignPricing(
      params.campaignId?.trim() || undefined,
      station?.campaign_id ?? null,
    )
    const depositAmount = Math.round(pricing.depositAmount * 100) || DEFAULT_PRICING.preAuthAmountCents

    let targetSlot = params.slotNumber
    let createdSession: DbRentalSession | null = null
    let unlockToken: string | null = null

    const existing = await sessionRepository.getActiveByUserId(userId)
    if (existing?.status === 'active') {
      return {
        success: false,
        error: 'You already have an active rental. Return your power bank or view your rental status.',
      }
    }

    if (existing?.status === 'pending') {
      if (existing.payment_status === 'authorized' || existing.payment_status === 'captured') {
        return {
          success: false,
          error: 'Payment already completed for this rental. Refresh the page to continue.',
        }
      }

      const sameStation = existing.pickup_station_id === params.stationId
      if (sameStation && existing.session_code) {
        createdSession = existing as DbRentalSession
        targetSlot = existing.pickup_slot_number ?? targetSlot
        unlockToken = await sessionRepository.ensureUnlockToken(existing.id)
      } else {
        await sessionRepository.abandonPendingCheckout(existing)
      }
    }

    if (!targetSlot) {
      const availableSlot = await stationRepository.getAvailableSlot(params.stationId)
      if (!availableSlot) {
        return { success: false, error: 'No power banks available at this station' }
      }
      targetSlot = availableSlot.slot_number
    }

    if (!createdSession || !unlockToken) {
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
        const prepDetails = getErrorDetails(prepError)
        logger.error('Failed to prepare rental session', {
          error: prepMessage,
          errorDetails: prepDetails,
          stationId: params.stationId,
          slotNumber: targetSlot,
          campaignId: pricing.campaignId ?? null,
        })
        const userMessage =
          prepMessage.includes('schema cache') || prepMessage.includes('does not exist')
            ? 'Rental system is updating. Please try again in a moment or contact support.'
            : prepMessage.includes('invalid input syntax for type uuid')
              ? 'Rental setup failed due to invalid station data. Please contact support.'
              : prepMessage.includes('violates not-null constraint')
                ? 'Rental database schema is out of date. Run migration 017 in Supabase, then retry.'
                : prepMessage.includes('idx_sessions_one_open_per_user') ||
                    prepDetails.code === '23505'
                  ? 'You already have an open checkout. Refresh the page and try again.'
                  : 'Failed to create rental session'
        return { success: false, error: userMessage }
      }
    }

    if (!createdSession || !unlockToken) {
      return { success: false, error: 'Failed to create rental session' }
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
      campaignId: pricing.campaignId,
      depositAmountCents: depositAmount,
      successUrl: `${baseUrl}/?session=${sessionCode}`,
      cancelUrl: `${baseUrl}/?cancel=${sessionCode}`,
    })

    return {
      success: true,
      clientSecret: checkoutResult.clientSecret,
      sessionCode,
      sessionId: createdSession.id,
      checkoutSessionId: checkoutResult.sessionId,
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

function isCheckoutPaymentComplete(session: DbRentalSession): boolean {
  return (
    session.status === 'active' ||
    session.payment_status === 'authorized' ||
    session.payment_status === 'captured'
  )
}

export async function getCheckoutStatus(sessionCode: string, checkoutSessionId?: string) {
  try {
    const session = await sessionRepository.getByCode(sessionCode)

    if (!session) {
      return { status: 'failed' as const, error: 'Session not found' }
    }

    if (isCheckoutPaymentComplete(session)) {
      const borrow = await dispatchBorrowBySessionCode(sessionCode)
      if (!borrow.success && !borrow.skipped) {
        logger.warn('Borrow dispatch on completed checkout failed', {
          sessionCode,
          error: borrow.error,
        })
      }
      return { status: 'completed' as const, paymentStatus: session.payment_status }
    }

    if (
      checkoutSessionId &&
      process.env.STRIPE_SECRET_KEY &&
      session.payment_status === 'pending'
    ) {
      try {
        const checkout = await getCheckoutSession(checkoutSessionId)
        const paymentIntentId =
          typeof checkout.payment_intent === 'string'
            ? checkout.payment_intent
            : checkout.payment_intent?.id
        let piStatus =
          typeof checkout.payment_intent === 'string'
            ? undefined
            : checkout.payment_intent?.status

        if (paymentIntentId && !piStatus) {
          const paymentIntent = await getPaymentIntent(paymentIntentId)
          piStatus = paymentIntent.status
        }

        if (
          checkout.status === 'complete' &&
          paymentIntentId &&
          (piStatus === 'requires_capture' || piStatus === 'succeeded')
        ) {
          await updateRentalSessionFromWebhook(sessionCode, {
            payment_status: 'authorized',
            payment_intent_id: paymentIntentId,
            metadata: {
              checkout_session_id: checkout.id,
              payment_confirmed_at: new Date().toISOString(),
              source: 'checkout_status_sync',
            },
          })

          const borrow = await dispatchBorrowBySessionCode(sessionCode)
          if (!borrow.success && !borrow.skipped) {
            logger.warn('Borrow dispatch after checkout sync failed', {
              sessionCode,
              error: borrow.error,
            })
          }

          return { status: 'completed' as const, paymentStatus: 'authorized' as const }
        }
      } catch (syncError) {
        logger.warn('Checkout status Stripe sync failed', {
          sessionCode,
          checkoutSessionId,
          error: syncError instanceof Error ? syncError.message : String(syncError),
        })
      }
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
