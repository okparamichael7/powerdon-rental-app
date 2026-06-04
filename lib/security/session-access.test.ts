import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { verifyUnlockToken } from './session-access'

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
