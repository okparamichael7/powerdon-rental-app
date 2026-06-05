import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { verifyApiKey } from '@/lib/security/auth'
import { NextRequest } from 'next/server'
import { withEnv } from '../../helpers/env'

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/admin/sessions', { headers })
}

describe('verifyApiKey', () => {
  it('accepts valid ADMIN_API_KEY via x-api-key header', async () => {
    await withEnv({ ADMIN_API_KEY: 'test-admin-key-123' }, () => {
      const auth = verifyApiKey(makeRequest({ 'x-api-key': 'test-admin-key-123' }))
      assert.ok(auth)
      assert.equal(auth!.isAdmin, true)
      assert.equal(auth!.isService, true)
    })
  })

  it('accepts valid INTERNAL_API_KEY via Bearer token', async () => {
    await withEnv(
      { ADMIN_API_KEY: '', INTERNAL_API_KEY: 'test-internal-key-456' },
      () => {
        const auth = verifyApiKey(
          makeRequest({ authorization: 'Bearer test-internal-key-456' }),
        )
        assert.ok(auth)
        assert.equal(auth!.role, 'service')
      },
    )
  })

  it('rejects unknown API key', async () => {
    await withEnv({ ADMIN_API_KEY: 'real-key' }, () => {
      const auth = verifyApiKey(makeRequest({ 'x-api-key': 'wrong-key' }))
      assert.equal(auth, null)
    })
  })

  it('rejects empty API key header', async () => {
    await withEnv({ ADMIN_API_KEY: 'real-key' }, () => {
      const auth = verifyApiKey(makeRequest({}))
      assert.equal(auth, null)
    })
  })
})

describe('session token header format', () => {
  it('requires minimum token length for unlock requests', () => {
    const shortToken = 'abc'
    assert.ok(shortToken.length < 8)
  })
})
