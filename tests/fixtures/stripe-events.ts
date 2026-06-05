/**
 * Stripe webhook event fixtures for payment lifecycle tests.
 */

export function buildPaymentIntentEvent(
  type: string,
  paymentIntent: Record<string, unknown>,
  eventId = `evt_test_${Date.now()}`,
) {
  return {
    id: eventId,
    object: 'event',
    type,
    livemode: false,
    created: Math.floor(Date.now() / 1000),
    data: { object: paymentIntent },
  }
}

export function buildPaymentIntent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pi_test_123',
    object: 'payment_intent',
    amount: 2800,
    amount_capturable: 2800,
    currency: 'eur',
    status: 'requires_capture',
    capture_method: 'manual',
    metadata: {
      session_id: '550e8400-e29b-41d4-a716-446655440003',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      stationId: '550e8400-e29b-41d4-a716-446655440001',
      slotNumber: '1',
      type: 'rental_deposit',
    },
    ...overrides,
  }
}

export function buildCheckoutSessionCompleted(overrides: Record<string, unknown> = {}) {
  return buildPaymentIntentEvent('checkout.session.completed', {
    id: 'cs_test_123',
    object: 'checkout.session',
    payment_intent: 'pi_test_123',
    payment_status: 'paid',
    metadata: {
      session_id: '550e8400-e29b-41d4-a716-446655440003',
    },
    ...overrides,
  })
}

export function buildPaymentIntentAuthorized(overrides: Record<string, unknown> = {}) {
  return buildPaymentIntentEvent(
    'payment_intent.amount_capturable_updated',
    buildPaymentIntent({ status: 'requires_capture', amount_capturable: 2800, ...overrides }),
  )
}

export function buildPaymentIntentFailed(overrides: Record<string, unknown> = {}) {
  return buildPaymentIntentEvent(
    'payment_intent.payment_failed',
    buildPaymentIntent({ status: 'requires_payment_method', last_payment_error: { message: 'Card declined' }, ...overrides }),
  )
}

export function buildChargeRefunded(overrides: Record<string, unknown> = {}) {
  return buildPaymentIntentEvent('charge.refunded', {
    id: 'ch_test_123',
    object: 'charge',
    payment_intent: 'pi_test_123',
    amount_refunded: 2800,
    refunded: true,
    ...overrides,
  })
}
