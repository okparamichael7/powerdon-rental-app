import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractSessionCode,
  isDuplicateWebhookEvent,
  mapPaymentIntentAuthorizedUpdate,
  mapPaymentIntentFailedUpdate,
  mapPaymentIntentSucceededUpdate,
  mapCheckoutSessionCompletedUpdate,
  mapCheckoutSessionExpiredUpdate,
  mapChargeRefundedUpdate,
} from '@/lib/stripe/webhook-state-mappers'

describe('extractSessionCode', () => {
  it('reads session_id from Stripe metadata', () => {
    assert.equal(extractSessionCode({ session_id: 'AB12CD34' }), 'AB12CD34')
  })

  it('falls back to sessionId camelCase', () => {
    assert.equal(extractSessionCode({ sessionId: 'XY99ZZ01' }), 'XY99ZZ01')
  })

  it('returns null for missing metadata', () => {
    assert.equal(extractSessionCode(undefined), null)
  })
})

describe('mapPaymentIntentAuthorizedUpdate', () => {
  it('maps authorization and triggers borrow dispatch flag', () => {
    const mapped = mapPaymentIntentAuthorizedUpdate({
      id: 'pi_test',
      amount: 2800,
      metadata: { session_id: 'AB12CD34' },
    })
    assert.equal(mapped.sessionCode, 'AB12CD34')
    assert.equal(mapped.rentalSession.payment_status, 'authorized')
    assert.equal(mapped.shouldDispatchBorrow, true)
    assert.equal(mapped.rentalSession.deposit_amount, 28)
  })
})

describe('mapPaymentIntentFailedUpdate', () => {
  it('maps failed payment to failed session status', () => {
    const mapped = mapPaymentIntentFailedUpdate({
      id: 'pi_fail',
      metadata: { session_id: 'AB12CD34' },
      last_payment_error: { message: 'Card declined', code: 'card_declined' } as never,
    })
    assert.equal(mapped.rentalSession.status, 'failed')
    assert.equal(mapped.rentalSession.payment_status, 'failed')
    assert.equal(mapped.rentalSession.error_message, 'Card declined')
  })
})

describe('mapPaymentIntentSucceededUpdate', () => {
  it('maps capture amount in euros', () => {
    const mapped = mapPaymentIntentSucceededUpdate({
      id: 'pi_ok',
      amount_received: 500,
      metadata: { session_id: 'AB12CD34' },
    })
    assert.equal(mapped.rentalSession.payment_status, 'captured')
    assert.equal(mapped.rentalSession.total_charge, 5)
    assert.equal(mapped.shouldDispatchBorrow, false)
  })
})

describe('mapCheckoutSessionCompletedUpdate', () => {
  it('keeps session pending and authorized after checkout', () => {
    const mapped = mapCheckoutSessionCompletedUpdate({
      id: 'cs_test',
      payment_intent: 'pi_test',
      metadata: { session_id: 'AB12CD34' },
    })
    assert.equal(mapped.rentalSession.status, 'pending')
    assert.equal(mapped.rentalSession.payment_status, 'authorized')
    assert.equal(mapped.shouldDispatchBorrow, true)
  })
})

describe('mapCheckoutSessionExpiredUpdate', () => {
  it('cancels session on checkout expiry', () => {
    const mapped = mapCheckoutSessionExpiredUpdate({
      id: 'cs_exp',
      metadata: { session_id: 'AB12CD34' },
    })
    assert.equal(mapped.rentalSession.status, 'cancelled')
    assert.equal(mapped.rentalSession.payment_status, 'expired')
  })
})

describe('mapChargeRefundedUpdate', () => {
  it('links refund to payment intent', () => {
    const mapped = mapChargeRefundedUpdate({
      id: 'ch_ref',
      amount_refunded: 2800,
      payment_intent: 'pi_test',
    })
    assert.equal(mapped.paymentIntentId, 'pi_test')
    assert.equal(mapped.rentalSession.payment_status, 'refunded')
    assert.equal(mapped.rentalSession.amount_refunded, 28)
  })
})

describe('isDuplicateWebhookEvent', () => {
  it('detects Postgres unique violation', () => {
    assert.equal(isDuplicateWebhookEvent('23505'), true)
    assert.equal(isDuplicateWebhookEvent('42P01'), false)
  })
})
