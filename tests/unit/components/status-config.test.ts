import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getStatusBadgeConfig, STATUS_BADGE_CONFIG } from '@/lib/admin/status-config'

describe('status-config (component data layer)', () => {
  it('defines labels for all rental session statuses', () => {
    for (const status of ['pending', 'active', 'completed', 'expired', 'failed', 'cancelled']) {
      assert.ok(STATUS_BADGE_CONFIG[status], `missing config for ${status}`)
      assert.ok(getStatusBadgeConfig(status).label.length > 0)
    }
  })

  it('defines payment status labels', () => {
    assert.equal(getStatusBadgeConfig('authorized').label, 'Authorized')
    assert.equal(getStatusBadgeConfig('captured').label, 'Captured')
    assert.equal(getStatusBadgeConfig('refunded').label, 'Refunded')
  })

  it('falls back for unknown status', () => {
    assert.equal(getStatusBadgeConfig('custom').label, 'custom')
  })
})
