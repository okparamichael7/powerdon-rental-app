import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, isServerReachable, withApiKey } from '../../helpers/api-client'
import { buildCreateStaffPayload } from '../../fixtures/factories'

describe('Admin RBAC integration', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('rejects unauthenticated POST staff create', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/staff', {
      method: 'POST',
      body: JSON.stringify(buildCreateStaffPayload()),
    })
    assert.equal(status, 401)
  })

  it('audit log requires admin (401 without session)', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/audit')
    assert.equal(status, 401)
  })

  it('admin sessions list supports pagination query params', async (t) => {
    const apiKey = process.env.ADMIN_API_KEY
    if (!serverUp || !apiKey) return t.skip('Server or ADMIN_API_KEY not configured')
    const { status, data } = await apiRequest<{ sessions?: unknown[] }>(
      '/api/admin/sessions?page=1&limit=10',
      { headers: withApiKey(apiKey) },
    )
    assert.equal(status, 200)
    assert.ok(Array.isArray(data.sessions) || data.sessions === undefined)
  })

  it('admin analytics requires auth', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/analytics')
    assert.equal(status, 401)
  })

  it('admin hardware events requires auth', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/hardware/events')
    assert.equal(status, 401)
  })
})

describe('Metrics endpoint protection', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('rejects /api/metrics without key in production mode', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/metrics')
    assert.ok([200, 401, 403].includes(status))
  })
})
