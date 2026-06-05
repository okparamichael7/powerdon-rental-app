import type Stripe from 'stripe'
import type { PaymentStatus, SessionStatus } from '@/lib/db/types'

export type WebhookSessionUpdate = {
  sessionCode: string | null
  rentalSession: Record<string, unknown>
  shouldDispatchBorrow: boolean
}

export function extractSessionCode(
  metadata: Stripe.Metadata | null | undefined,
): string | null {
  if (!metadata) return null
  const code = metadata.session_id ?? metadata.sessionId
  return typeof code === 'string' && code.length > 0 ? code : null
}

export function mapPaymentIntentSucceededUpdate(
  paymentIntent: Pick<Stripe.PaymentIntent, 'id' | 'amount_received' | 'metadata'>,
): WebhookSessionUpdate {
  const sessionCode = extractSessionCode(paymentIntent.metadata)
  return {
    sessionCode,
    shouldDispatchBorrow: false,
    rentalSession: {
      payment_status: 'captured' satisfies PaymentStatus,
      payment_intent_id: paymentIntent.id,
      amount_charged: paymentIntent.amount_received / 100,
      metadata: {
        stripe_payment_intent: paymentIntent.id,
        captured_at: new Date().toISOString(),
        amount_received: paymentIntent.amount_received,
      },
    },
  }
}

export function mapPaymentIntentFailedUpdate(
  paymentIntent: Pick<Stripe.PaymentIntent, 'id' | 'last_payment_error' | 'metadata'>,
): WebhookSessionUpdate {
  const sessionCode = extractSessionCode(paymentIntent.metadata)
  return {
    sessionCode,
    shouldDispatchBorrow: false,
    rentalSession: {
      payment_status: 'failed' satisfies PaymentStatus,
      status: 'failed' satisfies SessionStatus,
      metadata: {
        stripe_payment_intent: paymentIntent.id,
        failed_at: new Date().toISOString(),
        failure_code: paymentIntent.last_payment_error?.code,
        failure_message: paymentIntent.last_payment_error?.message,
        error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
      },
    },
  }
}

export function mapPaymentIntentCanceledUpdate(
  paymentIntent: Pick<Stripe.PaymentIntent, 'id' | 'metadata'>,
): WebhookSessionUpdate {
  const sessionCode = extractSessionCode(paymentIntent.metadata)
  return {
    sessionCode,
    shouldDispatchBorrow: false,
    rentalSession: {
      payment_status: 'cancelled' satisfies PaymentStatus,
      metadata: {
        stripe_payment_intent: paymentIntent.id,
        canceled_at: new Date().toISOString(),
      },
    },
  }
}

export function mapPaymentIntentAuthorizedUpdate(
  paymentIntent: Pick<Stripe.PaymentIntent, 'id' | 'amount' | 'metadata'>,
): WebhookSessionUpdate {
  const sessionCode = extractSessionCode(paymentIntent.metadata)
  return {
    sessionCode,
    shouldDispatchBorrow: Boolean(sessionCode),
    rentalSession: {
      payment_status: 'authorized' satisfies PaymentStatus,
      payment_intent_id: paymentIntent.id,
      deposit_amount: paymentIntent.amount / 100,
      metadata: {
        stripe_payment_intent: paymentIntent.id,
        authorized_at: new Date().toISOString(),
        authorized_amount: paymentIntent.amount,
      },
    },
  }
}

export function mapCheckoutSessionCompletedUpdate(
  session: Pick<Stripe.Checkout.Session, 'id' | 'metadata' | 'payment_intent'>,
): WebhookSessionUpdate {
  const sessionCode = extractSessionCode(session.metadata)
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

  return {
    sessionCode,
    shouldDispatchBorrow: Boolean(sessionCode),
    rentalSession: {
      payment_intent_id: paymentIntentId,
      payment_status: 'authorized' satisfies PaymentStatus,
      status: 'pending' satisfies SessionStatus,
      metadata: {
        checkout_session_id: session.id,
        completed_at: new Date().toISOString(),
      },
    },
  }
}

export function mapCheckoutSessionExpiredUpdate(
  session: Pick<Stripe.Checkout.Session, 'id' | 'metadata'>,
): WebhookSessionUpdate {
  const sessionCode = extractSessionCode(session.metadata)
  return {
    sessionCode,
    shouldDispatchBorrow: false,
    rentalSession: {
      status: 'cancelled' satisfies SessionStatus,
      payment_status: 'cancelled' satisfies PaymentStatus,
      ended_at: new Date().toISOString(),
      metadata: {
        checkout_session_id: session.id,
        expired_at: new Date().toISOString(),
        error_message: 'Checkout session expired',
      },
    },
  }
}

export function mapChargeRefundedUpdate(
  charge: Pick<Stripe.Charge, 'id' | 'amount_refunded' | 'payment_intent'>,
): { paymentIntentId: string | null; rentalSession: Record<string, unknown> } {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null

  return {
    paymentIntentId,
    rentalSession: {
      payment_status: 'refunded' satisfies PaymentStatus,
      amount_refunded: charge.amount_refunded / 100,
      metadata: {
        stripe_charge_id: charge.id,
        refunded_at: new Date().toISOString(),
      },
    },
  }
}

export function isDuplicateWebhookEvent(insertErrorCode: string | undefined): boolean {
  return insertErrorCode === '23505'
}
