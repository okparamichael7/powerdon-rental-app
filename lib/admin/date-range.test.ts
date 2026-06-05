import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { daysFromRange } from './date-range'

describe('daysFromRange', () => {
  it('maps known ranges', () => {
    assert.equal(daysFromRange('24h'), 1)
    assert.equal(daysFromRange('7d'), 7)
    assert.equal(daysFromRange('30d'), 30)
    assert.equal(daysFromRange('90d'), 90)
  })

  it('defaults unknown to 7', () => {
    assert.equal(daysFromRange('invalid'), 7)
  })
})
