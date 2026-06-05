import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isSchemaGapError, normalizeRewardRow } from './schema-compat'

describe('isSchemaGapError', () => {
  it('detects missing column errors', () => {
    assert.equal(
      isSchemaGapError({
        code: '42703',
        message: 'column rental_sessions.amount_charged does not exist',
      }),
      true,
    )
  })

  it('detects missing relationship errors', () => {
    assert.equal(
      isSchemaGapError({
        code: 'PGRST200',
        message: "Could not find a relationship between 'rental_sessions' and 'stations'",
      }),
      true,
    )
  })

  it('detects PostgREST schema cache column errors', () => {
    assert.equal(
      isSchemaGapError({
        code: 'PGRST204',
        message: "Could not find the 'marketing_consent_at' column of 'users' in the schema cache",
      }),
      true,
    )
    assert.equal(
      isSchemaGapError({
        code: 'PGRST204',
        message: "Could not find the 'unlock_token' column of 'rental_sessions' in the schema cache",
      }),
      true,
    )
  })

  it('returns false for unrelated errors', () => {
    assert.equal(isSchemaGapError({ code: '23505', message: 'duplicate key' }), false)
    assert.equal(isSchemaGapError(null), false)
  })
})

describe('normalizeRewardRow', () => {
  it('maps reward_value and created_at to canonical fields', () => {
    const row = normalizeRewardRow({
      id: 'r1',
      code: 'PD-ABC123',
      session_id: 's1',
      user_id: 'u1',
      campaign_id: 'c1',
      reward_type: 'voucher',
      reward_value: 15,
      description: 'Test',
      status: 'issued',
      expires_at: '2026-01-01T00:00:00.000Z',
      created_at: '2025-06-01T12:00:00.000Z',
      updated_at: '2025-06-01T12:00:00.000Z',
      metadata: {},
    })

    assert.equal(row.value, 15)
    assert.equal(row.issued_at, '2025-06-01T12:00:00.000Z')
    assert.equal(row.redeemed_at, null)
  })

  it('prefers canonical value and issued_at when present', () => {
    const row = normalizeRewardRow({
      id: 'r2',
      code: 'PD-XYZ',
      session_id: 's2',
      user_id: 'u2',
      campaign_id: 'c2',
      reward_type: 'voucher',
      value: 20,
      reward_value: 15,
      status: 'redeemed',
      issued_at: '2025-05-01T00:00:00.000Z',
      expires_at: '2026-01-01T00:00:00.000Z',
      redeemed_at: '2025-06-02T00:00:00.000Z',
      created_at: '2025-04-01T00:00:00.000Z',
      updated_at: '2025-06-02T00:00:00.000Z',
      metadata: {},
    })

    assert.equal(row.value, 20)
    assert.equal(row.issued_at, '2025-05-01T00:00:00.000Z')
    assert.equal(row.redeemed_at, '2025-06-02T00:00:00.000Z')
  })
})
