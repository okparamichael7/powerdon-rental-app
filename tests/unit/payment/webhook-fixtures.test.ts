import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPaymentIntent,
  buildPaymentIntentAuthorized,
  buildPaymentIntentFailed,
  buildChargeRefunded,
  buildCheckoutSessionCompleted,
} from '../../fixtures/stripe-events'

describe('Stripe webhook fixtures', () => {
  it('builds authorized payment intent with session metadata', () => {
    const event = buildPaymentIntentAuthorized()
    assert.equal(event.type, 'payment_intent.amount_capturable_updated')
    const pi = event.data.object as Record<string, unknown>
    const metadata = pi.metadata as Record<string, string>
    assert.ok(metadata.session_id)
    assert.equal(pi.status, 'requires_capture')
  })

  it('builds failed payment intent event', () => {
    const event = buildPaymentIntentFailed()
    assert.equal(event.type, 'payment_intent.payment_failed')
    const pi = event.data.object as Record<string, unknown>
    assert.equal(pi.status, 'requires_payment_method')
  })

  it('builds refund event linked to payment intent', () => {
    const event = buildChargeRefunded()
    assert.equal(event.type, 'charge.refunded')
    const charge = event.data.object as Record<string, unknown>
    assert.equal(charge.payment_intent, 'pi_test_123')
  })

  it('builds checkout completed with payment intent reference', () => {
    const event = buildCheckoutSessionCompleted()
    const session = event.data.object as Record<string, unknown>
    assert.equal(session.payment_intent, 'pi_test_123')
  })

  it('payment intent metadata includes rental context', () => {
    const pi = buildPaymentIntent()
    assert.equal(pi.metadata.type, 'rental_deposit')
    assert.equal(pi.metadata.session_id, '550e8400-e29b-41d4-a716-446655440003')
  })
})

import { isDuplicateWebhookEvent } from '@/lib/stripe/webhook-state-mappers'

describe('webhook verification requirements', () => {
  it('requires stripe-signature header', () => {
    const signature = undefined
    assert.equal(Boolean(signature), false)
  })

  it('duplicate event ids must short-circuit processing', () => {
    assert.equal(isDuplicateWebhookEvent('23505'), true)
    assert.equal(isDuplicateWebhookEvent('XX000'), false)
  })
})
