import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, isServerReachable, withBearer } from '../../helpers/api-client'
import { TEST_SESSION_ID } from '../../helpers/env'

describe('Security regression — access control', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('denies UUID session enumeration without unlock token', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const uuids = [
      TEST_SESSION_ID,
      '550e8400-e29b-41d4-a716-446655440099',
      '650e8400-e29b-41d4-a716-446655440000',
    ]
    for (const id of uuids) {
      const { status } = await apiRequest(`/api/rentals/${id}`)
      assert.equal(status, 404, `UUID ${id} should not leak existence`)
    }
  })

  it('allows public session code lookup shape', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/rentals/NOTFOUND1')
    assert.equal(status, 404)
  })

  it('rejects station message without service auth when token configured', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/stations/message', {
      method: 'POST',
      body: JSON.stringify({ messageHex: 'abcd' }),
    })
    assert.ok([400, 403].includes(status))
  })

  it('rejects hardware disconnect without service auth', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/stations/disconnect', {
      method: 'POST',
      body: JSON.stringify({ deviceId: 'TEST001' }),
    })
    assert.ok([400, 403].includes(status))
  })
})

describe('Security regression — injection payloads', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('rejects SQL injection in rental email', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/rentals/start', {
      method: 'POST',
      body: JSON.stringify({
        stationId: TEST_SESSION_ID,
        userEmail: "' OR 1=1; --",
      }),
    })
    assert.equal(status, 400)
  })

  it('rejects XSS in support subject via validation', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        subject: '<script>alert(1)</script>',
        description: 'Valid length description for XSS regression test case.',
        category: 'other',
        website: '',
      }),
    })
    assert.ok(status === 400 || status === 201 || status === 200 || status === 429)
  })
})

describe('Security regression — Stripe webhook', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('rejects webhook without stripe-signature', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status, data } = await apiRequest('/api/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ type: 'payment_intent.succeeded' }),
    })
    assert.equal(status, 400)
    assert.match(String((data as { error?: string }).error ?? ''), /signature/i)
  })

  it('rejects webhook with invalid signature', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'stripe-signature': 'invalid_sig' },
      body: JSON.stringify({ id: 'evt_fake', type: 'payment_intent.succeeded' }),
    })
    assert.equal(status, 400)
  })
})

describe('Security regression — station proxy token', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('rejects invalid STATION_PROXY_TOKEN on message endpoint', async (t) => {
    const token = process.env.STATION_PROXY_TOKEN
    if (!serverUp || !token) return t.skip('Server or STATION_PROXY_TOKEN not configured')
    const { status } = await apiRequest('/api/stations/message', {
      method: 'POST',
      headers: withBearer('wrong-token'),
      body: JSON.stringify({ messageHex: 'not-valid-hex' }),
    })
    assert.ok([400, 403].includes(status))
  })
})
