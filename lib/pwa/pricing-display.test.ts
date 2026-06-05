import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatDailyCapLabel, formatLadderRateLabel, LADDER_PRICING } from './pricing-display'

describe('pricing-display', () => {
  it('formats ladder rate label', () => {
    assert.equal(formatLadderRateLabel(), '€1.00/15min')
  })

  it('formats daily cap with override', () => {
    assert.equal(formatDailyCapLabel(25), '€25.00')
    assert.equal(formatDailyCapLabel(), `€${LADDER_PRICING.dailyCapEur.toFixed(2)}`)
  })
})
