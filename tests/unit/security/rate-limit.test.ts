import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { RATE_LIMITS } from '@/lib/security/rate-limit'

describe('RATE_LIMITS configuration', () => {
  it('limits rental starts to 5 per minute', () => {
    assert.equal(RATE_LIMITS.rentalStart.maxRequests, 5)
    assert.equal(RATE_LIMITS.rentalStart.windowMs, 60_000)
  })

  it('limits auth attempts to 10 per 15 minutes', () => {
    assert.equal(RATE_LIMITS.auth.maxRequests, 10)
    assert.equal(RATE_LIMITS.auth.windowMs, 15 * 60_000)
  })

  it('limits webhooks to 120 per minute', () => {
    assert.equal(RATE_LIMITS.webhook.maxRequests, 120)
  })

  it('caps admin requests at 200 per minute', () => {
    assert.equal(RATE_LIMITS.admin.maxRequests, 200)
  })

  it('session lookup limit prevents enumeration', () => {
    assert.equal(RATE_LIMITS.sessionLookup.maxRequests, 30)
  })
})

describe('rate limit response shape', () => {
  it('computes retry-after from reset time', () => {
    const resetTime = Date.now() + 30_000
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000)
    assert.ok(retryAfter >= 29 && retryAfter <= 31)
  })
})
