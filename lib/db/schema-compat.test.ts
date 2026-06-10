import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  compactRecord,
  countWithSessionStatusFallback,
  filterLegacySessionStatuses,
  isInvalidEnumInputError,
  isInvalidUuidInputError,
  isSchemaGapError,
  missingColumnFromError,
  mutateWithSchemaFallback,
  normalizeRewardRow,
  stripEmptyUuidFields,
} from './schema-compat'

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

describe('stripEmptyUuidFields', () => {
  it('removes blank optional uuid columns', () => {
    const payload = stripEmptyUuidFields({
      user_id: '11111111-1111-1111-1111-111111111111',
      pickup_station_id: '22222222-2222-2222-2222-222222222222',
      campaign_id: '',
      power_bank_id: '   ',
      reward_id: null,
    })

    assert.equal(payload.user_id, '11111111-1111-1111-1111-111111111111')
    assert.equal(payload.pickup_station_id, '22222222-2222-2222-2222-222222222222')
    assert.equal('campaign_id' in payload, false)
    assert.equal('power_bank_id' in payload, false)
    assert.equal('reward_id' in payload, false)
  })
})

describe('isInvalidEnumInputError', () => {
  it('detects invalid session_status enum values', () => {
    assert.equal(
      isInvalidEnumInputError({
        code: '22P02',
        message: 'invalid input value for enum session_status: "expired"',
      }),
      true,
    )
  })
})

describe('filterLegacySessionStatuses', () => {
  it('removes expired for legacy databases', () => {
    assert.deepEqual(
      filterLegacySessionStatuses(['completed', 'expired', 'failed']),
      ['completed', 'failed'],
    )
  })
})

describe('countWithSessionStatusFallback', () => {
  it('retries without expired after enum rejection', async () => {
    let attempts = 0
    const count = await countWithSessionStatusFallback(
      ['completed', 'expired', 'failed'],
      async (statuses) => {
        attempts++
        if (statuses.includes('expired')) {
          return {
            count: null,
            error: {
              code: '22P02',
              message: 'invalid input value for enum session_status: "expired"',
            },
          }
        }
        return { count: 3, error: null }
      },
    )

    assert.equal(attempts, 2)
    assert.equal(count, 3)
  })
})

describe('isInvalidUuidInputError', () => {
  it('detects postgres uuid syntax errors', () => {
    assert.equal(
      isInvalidUuidInputError({
        code: '22P02',
        message: 'invalid input syntax for type uuid: ""',
      }),
      true,
    )
  })
})

describe('compactRecord', () => {
  it('omits null and undefined keys', () => {
    assert.deepEqual(
      compactRecord({
        name: 'Cabinet A',
        location: null,
        description: undefined,
        total_slots: 12,
      }),
      { name: 'Cabinet A', total_slots: 12 },
    )
  })
})

describe('mutateWithSchemaFallback', () => {
  it('drops unknown columns and retries', async () => {
    let attempts = 0
    const result = await mutateWithSchemaFallback(
      { name: 'Cabinet A', location: 'Lobby', total_slots: 8 },
      async (payload) => {
        attempts++
        if ('location' in payload) {
          return {
            data: null,
            error: {
              code: 'PGRST204',
              message: "Could not find the 'location' column of 'stations' in the schema cache",
            },
          }
        }
        return { data: { id: 'station-1', ...payload }, error: null }
      },
    )

    assert.equal(attempts, 2)
    assert.equal(result.id, 'station-1')
    assert.equal('location' in result, false)
  })

  it('strips invalid created_by FK and retries', async () => {
    let attempts = 0
    const result = await mutateWithSchemaFallback(
      { name: 'Cabinet B', created_by: 'bad-user', updated_by: 'bad-user' },
      async (payload) => {
        attempts++
        if ('created_by' in payload) {
          return {
            data: null,
            error: {
              code: '23503',
              message: 'insert violates foreign key constraint "stations_created_by_fkey"',
            },
          }
        }
        return { data: { id: 'station-2', ...payload }, error: null }
      },
    )

    assert.equal(attempts, 2)
    assert.equal(result.id, 'station-2')
    assert.equal('created_by' in result, false)
  })
})

describe('missingColumnFromError', () => {
  it('parses PostgREST schema cache messages', () => {
    assert.equal(
      missingColumnFromError(
        "Could not find the 'unlock_token' column of 'rental_sessions' in the schema cache",
      ),
      'unlock_token',
    )
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
