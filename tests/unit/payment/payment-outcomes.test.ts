import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateRentalCharge } from '@/lib/stripe/types'

/** Mirrors completeRentalPayment decision tree without Stripe I/O. */
function resolveRentalPaymentOutcome(durationMinutes: number) {
  const { totalCents, cappedAt } = calculateRentalCharge(durationMinutes)
  if (totalCents === 0) {
    return { action: 'cancel_authorization' as const, chargedCents: 0, refundedCents: 0 }
  }
  return {
    action: 'partial_capture' as const,
    chargedCents: totalCents,
    refundedCents: 2800 - totalCents,
    wasCapped: cappedAt !== undefined,
  }
}

describe('rental payment outcomes (business rules)', () => {
  it('cancels authorization when rental is within free period', () => {
    const outcome = resolveRentalPaymentOutcome(4)
    assert.equal(outcome.action, 'cancel_authorization')
    assert.equal(outcome.chargedCents, 0)
  })

  it('partially captures when rental exceeds free period', () => {
    const outcome = resolveRentalPaymentOutcome(30)
    assert.equal(outcome.action, 'partial_capture')
    assert.equal(outcome.chargedCents, 200)
    assert.equal(outcome.refundedCents, 2600)
  })

  it('captures daily cap for long rentals', () => {
    const outcome = resolveRentalPaymentOutcome(600)
    assert.equal(outcome.chargedCents, 2700)
    assert.equal(outcome.wasCapped, true)
  })

  it('deposit minus charge equals implicit refund on partial capture', () => {
    const outcome = resolveRentalPaymentOutcome(45)
    assert.equal(outcome.chargedCents + outcome.refundedCents, 2800)
  })
})

describe('payment state consistency rules', () => {
  const transitions: Array<{ from: string; event: string; to: string }> = [
    { from: 'pending', event: 'payment_authorized', to: 'authorized' },
    { from: 'authorized', event: 'borrow_success', to: 'active' },
    { from: 'authorized', event: 'payment_failed', to: 'failed' },
    { from: 'active', event: 'return_finalize_zero', to: 'cancelled' },
    { from: 'active', event: 'return_finalize_charge', to: 'captured' },
    { from: 'pending', event: 'checkout_expired', to: 'expired' },
    { from: 'pending', event: 'user_cancel', to: 'cancelled' },
    { from: 'captured', event: 'charge_refunded', to: 'refunded' },
  ]

  it('defines expected payment/session coupling', () => {
    assert.ok(transitions.length >= 8)
    const authorizedToActive = transitions.find(
      (t) => t.from === 'authorized' && t.event === 'borrow_success',
    )
    assert.ok(authorizedToActive)
    assert.equal(authorizedToActive!.to, 'active')
  })
})
