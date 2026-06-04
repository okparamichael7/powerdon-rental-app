import 'server-only'

import { sessionRepository } from '@/lib/db'
import { completeRentalPayment, cancelPaymentIntent } from '@/lib/stripe/payment-service'
import { logger } from '@/lib/observability/logger'
import type { DbRentalSession } from '@/lib/db/types'

/**
 * Close Stripe authorization after hardware return or cancel.
 */
export async function finalizeRentalPaymentOnReturn(
  session: Pick<
    DbRentalSession,
    'id' | 'payment_intent_id' | 'payment_status' | 'hourly_rate' | 'daily_cap'
  >,
  durationMinutes: number,
): Promise<{ chargedCents: number; paymentStatus: 'captured' | 'refunded' | 'cancelled' }> {
  const paymentIntentId = session.payment_intent_id
  if (!paymentIntentId) {
    return { chargedCents: 0, paymentStatus: 'refunded' }
  }

  if (session.payment_status === 'captured' || session.payment_status === 'refunded') {
    return { chargedCents: 0, paymentStatus: session.payment_status as 'captured' | 'refunded' }
  }

  try {
    const result = await completeRentalPayment(paymentIntentId, durationMinutes)
    const chargedCents = result.chargedAmountCents
    const paymentStatus = chargedCents > 0 ? 'captured' : 'cancelled'

    await sessionRepository.update(session.id, {
      payment_status: paymentStatus,
      amount_charged: chargedCents / 100,
    })

    return { chargedCents, paymentStatus: paymentStatus === 'cancelled' ? 'cancelled' : 'captured' }
  } catch (error) {
    logger.error('Stripe finalize on return failed', {
      sessionId: session.id,
      paymentIntentId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

export async function cancelRentalPaymentHold(
  session: Pick<DbRentalSession, 'id' | 'payment_intent_id' | 'payment_status'>,
  reason: string,
): Promise<void> {
  if (!session.payment_intent_id) return
  if (['captured', 'refunded', 'cancelled'].includes(session.payment_status)) return

  try {
    await cancelPaymentIntent(session.payment_intent_id, reason)
    await sessionRepository.update(session.id, { payment_status: 'cancelled' })
  } catch (error) {
    logger.error('Stripe cancel on rental cancel failed', {
      sessionId: session.id,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
