import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatStripeCheckoutError } from '@/lib/stripe/checkout-errors'

describe('formatStripeCheckoutError', () => {
  it('maps bank verification code errors', () => {
    const message = formatStripeCheckoutError(
      'consumer_verification_code_invalid: The provided verification code is incorrect.',
    )
    assert.match(message, /verification code/i)
  })

  it('maps session not found errors', () => {
    assert.match(formatStripeCheckoutError('Session not found'), /rental session/i)
  })

  it('maps session lookup failures after payment', () => {
    assert.match(formatStripeCheckoutError('Failed to get session'), /load your rental status/i)
  })

  it('passes through unknown errors', () => {
    assert.equal(formatStripeCheckoutError('Custom gateway error'), 'Custom gateway error')
  })
})
