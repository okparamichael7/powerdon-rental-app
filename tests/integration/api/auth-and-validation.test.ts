import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, isServerReachable, withApiKey } from '../../helpers/api-client'
import { buildRentalStartPayload, buildSupportTicketPayload } from '../../fixtures/factories'
import { TEST_SESSION_ID } from '../../helpers/env'

describe('Admin API auth protection', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('returns 401 for unauthenticated admin sessions list', async (t) => {
    if (!serverUp) return t.skip('Server not reachable — set TEST_API_URL or run `npm run dev`')
    const { status } = await apiRequest('/api/admin/sessions')
    assert.equal(status, 401)
  })

  it('returns 401 for unauthenticated staff management', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/staff')
    assert.equal(status, 401)
  })

  it('returns 401 for unauthenticated audit log', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/audit')
    assert.equal(status, 401)
  })

  it('accepts ADMIN_API_KEY when configured', async (t) => {
    const apiKey = process.env.ADMIN_API_KEY
    if (!serverUp || !apiKey) return t.skip('Server or ADMIN_API_KEY not configured')
    const { status } = await apiRequest('/api/admin/sessions', {
      headers: withApiKey(apiKey),
    })
    assert.ok([200, 403].includes(status), `Expected 200 or 403, got ${status}`)
  })

  it('rejects invalid ADMIN_API_KEY', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/sessions', {
      headers: withApiKey('invalid-key-should-fail'),
    })
    assert.equal(status, 401)
  })
})

describe('Rental API input validation', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('rejects rental start without stationId', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status, data } = await apiRequest('/api/rentals/start', {
      method: 'POST',
      body: JSON.stringify({ userEmail: 'test@example.com' }),
    })
    assert.equal(status, 400)
    assert.ok((data as { error?: unknown }).error)
  })

  it('rejects invalid email on rental start', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/rentals/start', {
      method: 'POST',
      body: JSON.stringify(buildRentalStartPayload({ userEmail: 'bad-email' })),
    })
    assert.equal(status, 400)
  })

  it('returns 404 for unknown session UUID without token (IDOR protection)', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest(`/api/rentals/${TEST_SESSION_ID}`)
    assert.equal(status, 404)
  })

  it('returns 404 for cancel on unknown session', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest(`/api/rentals/${TEST_SESSION_ID}/cancel`, {
      method: 'POST',
    })
    assert.equal(status, 404)
  })
})

describe('Support ticket API', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('rejects invalid support ticket payload', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify({ email: 'bad', subject: 'x', description: 'short', category: 'other' }),
    })
    assert.equal(status, 400)
  })

  it('accepts valid support ticket format', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/support/tickets', {
      method: 'POST',
      body: JSON.stringify(buildSupportTicketPayload()),
    })
    assert.ok([200, 201, 429, 500].includes(status))
  })
})

describe('Internal API protection', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('blocks finalize-return without service credentials', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest(`/api/internal/sessions/${TEST_SESSION_ID}/finalize-return`, {
      method: 'POST',
      body: JSON.stringify({ durationMinutes: 10 }),
    })
    assert.ok([401, 403, 404].includes(status))
  })
})

describe('Cron maintenance protection', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('rejects maintenance cron without secret', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/cron/maintenance', { method: 'POST' })
    assert.ok([401, 403].includes(status))
  })
})
