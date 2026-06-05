import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { calculateCharge, calculateRewardProgress, formatCurrency } from '@/lib/session-store'
import { calculateRentalCharge } from '@/lib/stripe/types'

function estimateRentalChargeEur(durationMinutes: number): number {
  const { totalCents } = calculateRentalCharge(Math.max(0, durationMinutes))
  return Math.round(totalCents) / 100
}

describe('calculateCharge (client session store)', () => {
  it('matches server ladder for 0 minutes', () => {
    assert.equal(calculateCharge(0, 4, 27), 0)
  })

  it('matches server ladder for 30 minutes', () => {
    assert.equal(calculateCharge(30, 4, 27), 2)
  })

  it('matches estimateRentalChargeEur', () => {
    assert.equal(calculateCharge(45, 4, 27), estimateRentalChargeEur(45))
  })
})

describe('calculateRewardProgress', () => {
  it('returns 0 at start', () => {
    assert.equal(calculateRewardProgress(0, 60), 0)
  })

  it('returns 50 at half threshold', () => {
    assert.equal(calculateRewardProgress(30, 60), 50)
  })

  it('caps at 100 beyond threshold', () => {
    assert.equal(calculateRewardProgress(120, 60), 100)
  })
})

describe('formatCurrency', () => {
  it('formats euro amounts', () => {
    assert.equal(formatCurrency(12.5), '€12.50')
  })
})
