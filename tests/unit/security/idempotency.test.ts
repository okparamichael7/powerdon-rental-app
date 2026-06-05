import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isDuplicateWebhookEvent } from '@/lib/stripe/webhook-state-mappers'
import { hardwareEventIdempotencyKey } from '@/lib/wscharge/idempotency'

describe('hardwareEventIdempotencyKey', () => {
  it('returns stable hash for same inputs', () => {
    const params = {
      stationExternalId: 'STATION001',
      eventType: 'borrow_result',
      messageHex: 'aabbcc',
    }
    const a = hardwareEventIdempotencyKey(params)
    const b = hardwareEventIdempotencyKey(params)
    assert.equal(a, b)
    assert.match(a, /^[a-f0-9]{64}$/)
  })

  it('differs when messageHex changes', () => {
    const base = {
      stationExternalId: 'STATION001',
      eventType: 'borrow_result',
      messageHex: 'aabbcc',
    }
    const a = hardwareEventIdempotencyKey(base)
    const b = hardwareEventIdempotencyKey({ ...base, messageHex: 'ddeeff' })
    assert.notEqual(a, b)
  })

  it('differs when station changes', () => {
    const base = {
      stationExternalId: 'STATION001',
      eventType: 'return',
      messageHex: 'aabbcc',
    }
    const a = hardwareEventIdempotencyKey(base)
    const b = hardwareEventIdempotencyKey({ ...base, stationExternalId: 'STATION002' })
    assert.notEqual(a, b)
  })
})

describe('duplicate webhook handling rules', () => {
  it('treats duplicate event_id as no-op success', () => {
    assert.equal(isDuplicateWebhookEvent('23505'), true)
    assert.equal(isDuplicateWebhookEvent(undefined), false)
  })
})
