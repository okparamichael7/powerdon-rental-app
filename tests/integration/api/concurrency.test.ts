import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, isServerReachable } from '../../helpers/api-client'
import { buildRentalStartPayload } from '../../fixtures/factories'
import { SEED } from '../../fixtures/seed-data'

describe('Double-booking / concurrency guard', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('parallel rental starts return consistent validation (no 500s)', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const payload = buildRentalStartPayload({
      stationId: SEED.station.id,
      userEmail: `concurrency-${Date.now()}@powerdon.test`,
    })

    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        apiRequest('/api/rentals/start', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      ),
    )

    for (const { status } of results) {
      assert.ok(status < 500, `Unexpected server error: ${status}`)
      assert.ok(
        [200, 201, 400, 404, 409, 503].includes(status),
        `Unexpected status ${status}`,
      )
    }

    const successes = results.filter((r) => r.status === 200 || r.status === 201)
    assert.ok(successes.length <= 1, 'At most one concurrent start should succeed per user/station')
  })
})

describe('Cron maintenance with secret', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('accepts maintenance when CRON_SECRET matches', async (t) => {
    const secret = process.env.CRON_SECRET
    if (!serverUp || !secret) return t.skip('Server or CRON_SECRET not configured')
    const { status } = await apiRequest('/api/cron/maintenance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    })
    assert.ok([200, 204].includes(status), `Expected 200/204, got ${status}`)
  })
})
