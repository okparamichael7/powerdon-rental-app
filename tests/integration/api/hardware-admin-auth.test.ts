import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { apiRequest, isServerReachable } from '../../helpers/api-client'

describe('Hardware admin API auth protection', () => {
  let serverUp = false

  before(async () => {
    serverUp = await isServerReachable()
  })

  it('returns 401 for unauthenticated hardware list', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/stations')
    assert.equal(status, 401)
  })

  it('returns 401 for unauthenticated operations hub', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/operations-hub')
    assert.equal(status, 401)
  })

  it('returns 401 for unauthenticated hardware detail', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest(
      '/api/admin/stations/00000000-0000-4000-8000-000000000001/detail',
    )
    assert.equal(status, 401)
  })

  it('returns 401 for unauthenticated hardware create', async (t) => {
    if (!serverUp) return t.skip('Server not reachable')
    const { status } = await apiRequest('/api/admin/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test',
        externalId: 'TESTUNIT01',
        totalSlots: 4,
      }),
    })
    assert.equal(status, 401)
  })
})
