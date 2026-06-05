import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateCharge } from '@/lib/session-store'

describe('calculateCharge (PWA client)', () => {
  it('matches Stripe ladder: 5 min free', () => {
    assert.equal(calculateCharge(5, 2, 27), 0)
  })

  it('matches Stripe ladder: 20 min = €1', () => {
    assert.equal(calculateCharge(20, 2, 27), 1)
  })
})
