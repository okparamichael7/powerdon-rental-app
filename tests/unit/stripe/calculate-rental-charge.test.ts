import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateRentalCharge,
  calculateSimpleCharge,
  DEFAULT_PRICING,
  formatCurrency,
  mapPaymentIntentStatus,
} from '@/lib/stripe/types'

describe('calculateRentalCharge', () => {
  it('charges nothing within free period (5 minutes)', () => {
    const result = calculateRentalCharge(5)
    assert.equal(result.totalCents, 0)
    assert.equal(result.breakdown.length, 1)
    assert.equal(result.breakdown[0].tier, 'Free period')
  })

  it('charges €1.00 for 16 minutes (first billable 15-min interval after free period)', () => {
    const result = calculateRentalCharge(16)
    assert.equal(result.totalCents, 100)
  })

  it('charges €2.00 for 31 minutes (two 15-min intervals)', () => {
    const result = calculateRentalCharge(31)
    assert.equal(result.totalCents, 200)
  })

  it('applies daily cap at €27.00', () => {
    const result = calculateRentalCharge(24 * 60)
    assert.equal(result.totalCents, DEFAULT_PRICING.dailyCapAmountCents)
    assert.equal(result.cappedAt, DEFAULT_PRICING.dailyCapAmountCents)
  })

  it('rounds up partial intervals', () => {
    assert.equal(calculateSimpleCharge(6), 100)
    assert.equal(calculateSimpleCharge(20), 100)
    assert.equal(calculateSimpleCharge(21), 200)
  })

  it('handles zero duration', () => {
    assert.equal(calculateSimpleCharge(0), 0)
  })

  it('handles negative duration as zero charge path via max(0) callers', () => {
    const result = calculateRentalCharge(-5)
    assert.equal(result.totalCents, 0)
  })
})

describe('formatCurrency', () => {
  it('formats EUR amounts', () => {
    const formatted = formatCurrency(2800, 'eur')
    assert.match(formatted, /28/)
  })
})

describe('mapPaymentIntentStatus', () => {
  it('maps requires_capture to authorized', () => {
    assert.equal(mapPaymentIntentStatus('requires_capture'), 'authorized')
  })

  it('maps succeeded to captured', () => {
    assert.equal(mapPaymentIntentStatus('succeeded'), 'captured')
  })

  it('maps canceled to canceled', () => {
    assert.equal(mapPaymentIntentStatus('canceled'), 'canceled')
  })

  it('maps requires_payment_method', () => {
    assert.equal(mapPaymentIntentStatus('requires_payment_method'), 'requires_payment_method')
  })
})
