import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, isServerReachable } from '../../helpers/api-client'

describe('Production smoke — health & public endpoints', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('GET /api/health returns structured payload', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status, data } = await apiRequest<{
      status?: string
      timestamp?: string
      productionReady?: boolean
    }>('/api/health')
    assert.equal(status, 200)
    assert.ok(data.status)
    assert.ok(data.timestamp)
    assert.equal(typeof data.productionReady, 'boolean')
  })

  it('GET /api/stations returns station list', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status, data } = await apiRequest<{ stations?: unknown[] }>('/api/stations')
    assert.equal(status, 200)
    assert.ok(Array.isArray(data.stations))
  })

  it('GET /api/auth/staff-check returns role payload for anonymous', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/auth/staff-check')
    assert.ok([200, 401].includes(status))
  })

  it('POST /api/auth/login-attempt validates rate limit path exists', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/auth/login-attempt', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@test.com' }),
    })
    assert.ok(status < 500)
  })
})

describe('Production smoke — error handling', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('returns 404 for unknown API routes', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/does-not-exist')
    assert.equal(status, 404)
  })

  it('returns 400 for malformed JSON on message endpoint', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const baseUrl = process.env.TEST_API_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/stations/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ invalid json',
    })
    assert.equal(response.status, 400)
  })
})
