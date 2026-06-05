import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { denyUuidLookupWithoutAuth, isSessionUuid, verifyUnlockToken } from './session-access'

describe('verifyUnlockToken', () => {
  it('accepts matching non-expired token', () => {
    const ok = verifyUnlockToken(
      {
        unlock_token: 'abc123',
        unlock_token_expires_at: new Date(Date.now() + 60_000).toISOString(),
      },
      'abc123',
    )
    assert.equal(ok, true)
  })

  it('rejects expired token', () => {
    const ok = verifyUnlockToken(
      {
        unlock_token: 'abc123',
        unlock_token_expires_at: new Date(Date.now() - 60_000).toISOString(),
      },
      'abc123',
    )
    assert.equal(ok, false)
  })

  it('rejects missing token', () => {
    const ok = verifyUnlockToken({ unlock_token: 'abc123', unlock_token_expires_at: null }, null)
    assert.equal(ok, false)
  })
})

describe('denyUuidLookupWithoutAuth', () => {
  it('blocks UUID lookup without auth', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    assert.equal(isSessionUuid(uuid), true)
    const denied = denyUuidLookupWithoutAuth(uuid, false)
    assert.ok(denied)
    assert.equal(denied!.status, 404)
  })

  it('allows session code lookup without auth', () => {
    const denied = denyUuidLookupWithoutAuth('AB12CD34', false)
    assert.equal(denied, null)
  })

  it('allows UUID lookup when authorized', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    const denied = denyUuidLookupWithoutAuth(uuid, true)
    assert.equal(denied, null)
  })
})
